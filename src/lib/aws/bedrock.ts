/**
 * Bedrock LLM Client
 * Routes requests to Claude 3.5 Sonnet or Llama 3 based on task complexity
 * Handles streaming responses, retry logic, Ollama fallback, and cost tracking
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { getAWSConfig } from './config';

export interface BedrockConfig {
  region: string;
  models: {
    complex: string; // Claude 3.5 Sonnet
    simple: string;  // Llama 3
  };
}

export type TaskComplexity = 'simple' | 'complex';

export interface InvokeOptions {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  systemPrompt?: string;
}

export interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  model: string;
  costUSD: number;
}

// Pricing per 1000 tokens (approximate, ap-south-1)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'anthropic.claude-3-5-sonnet-20240620-v1:0': { input: 0.003, output: 0.015 },
  'meta.llama3-70b-instruct-v1:0': { input: 0.00265, output: 0.0035 },
};

export class BedrockLLMClient {
  private client: BedrockRuntimeClient;
  private models: { complex: string; simple: string };
  private totalCosts: CostEstimate[] = [];

  constructor(config?: BedrockConfig) {
    const awsConfig = getAWSConfig();
    const bedrockConfig = config || {
      region: awsConfig.bedrock.region,
      models: awsConfig.bedrock.models,
    };

    this.client = new BedrockRuntimeClient({
      region: bedrockConfig.region,
    });

    this.models = bedrockConfig.models;
  }

  /**
   * Select the appropriate model based on task complexity
   * Simple tasks (summarization, formatting) -> Llama 3
   * Complex tasks (code gen, analysis, refactoring) -> Claude 3.5 Sonnet
   */
  selectModel(complexity: TaskComplexity): string {
    return complexity === 'complex' ? this.models.complex : this.models.simple;
  }

  /**
   * Invoke Bedrock model with retry and optional Ollama fallback
   */
  async invoke(
    prompt: string,
    complexity: TaskComplexity,
    options?: InvokeOptions
  ): Promise<string> {
    const model = this.selectModel(complexity);
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await this._invokeModel(model, prompt, options);

        // Track cost
        const inputTokens = this._estimateTokenCount(prompt);
        const outputTokens = this._estimateTokenCount(result);
        this.totalCosts.push({
          inputTokens,
          outputTokens,
          model,
          costUSD: this.estimateCost(inputTokens, outputTokens, model),
        });

        return result;
      } catch (error: any) {
        lastError = error;
        if (attempt < maxRetries - 1) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = baseDelay * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed - attempt Ollama fallback
    try {
      const ollamaResult = await this._invokeOllama(prompt, complexity, options);
      return ollamaResult;
    } catch (ollamaError: any) {
      // Both Bedrock and Ollama failed
      throw new Error(
        `Bedrock failed after ${maxRetries} retries: ${lastError?.message}. ` +
        `Ollama fallback also failed: ${ollamaError.message}`
      );
    }
  }

  /**
   * Invoke Bedrock model with streaming response
   * Calls onChunk for each received text chunk
   */
  async invokeStream(
    prompt: string,
    complexity: TaskComplexity,
    onChunk: (chunk: string) => void,
    options?: InvokeOptions
  ): Promise<string> {
    const model = this.selectModel(complexity);
    const body = this._buildRequestBody(model, prompt, options);

    const command = new InvokeModelWithResponseStreamCommand({
      modelId: model,
      body: JSON.stringify(body),
      contentType: 'application/json',
      accept: 'application/json',
    });

    const response = await this.client.send(command);

    let fullResponse = '';

    if (response.body) {
      for await (const event of response.body) {
        if (event.chunk?.bytes) {
          const chunkData = JSON.parse(
            new TextDecoder().decode(event.chunk.bytes)
          );

          let text = '';
          if (model.includes('anthropic')) {
            // Claude response format
            if (chunkData.type === 'content_block_delta') {
              text = chunkData.delta?.text || '';
            }
          } else if (model.includes('meta')) {
            // Llama response format
            text = chunkData.generation || '';
          }

          if (text) {
            fullResponse += text;
            onChunk(text);
          }
        }
      }
    }

    // Track cost
    const inputTokens = this._estimateTokenCount(prompt);
    const outputTokens = this._estimateTokenCount(fullResponse);
    this.totalCosts.push({
      inputTokens,
      outputTokens,
      model,
      costUSD: this.estimateCost(inputTokens, outputTokens, model),
    });

    return fullResponse;
  }

  /**
   * Estimate cost for token usage
   */
  estimateCost(inputTokens: number, outputTokens: number, model: string): number {
    const pricing = MODEL_PRICING[model];
    if (!pricing) {
      // Default pricing if model not found
      return (inputTokens * 0.003 + outputTokens * 0.015) / 1000;
    }
    return (inputTokens * pricing.input + outputTokens * pricing.output) / 1000;
  }

  /**
   * Get total costs accumulated across all invocations
   */
  getTotalCost(): { total: number; breakdown: CostEstimate[] } {
    const total = this.totalCosts.reduce((sum, c) => sum + c.costUSD, 0);
    return { total, breakdown: [...this.totalCosts] };
  }

  /**
   * Reset cost tracking
   */
  resetCostTracking(): void {
    this.totalCosts = [];
  }

  /**
   * Internal: Invoke a specific Bedrock model
   */
  private async _invokeModel(
    model: string,
    prompt: string,
    options?: InvokeOptions
  ): Promise<string> {
    const body = this._buildRequestBody(model, prompt, options);

    const command = new InvokeModelCommand({
      modelId: model,
      body: JSON.stringify(body),
      contentType: 'application/json',
      accept: 'application/json',
    });

    const response = await this.client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    // Parse response based on model type
    if (model.includes('anthropic')) {
      // Claude response format
      return responseBody.content?.[0]?.text || '';
    } else if (model.includes('meta')) {
      // Llama response format
      return responseBody.generation || '';
    }

    throw new Error(`Unsupported model response format: ${model}`);
  }

  /**
   * Internal: Build request body for the specific model
   */
  private _buildRequestBody(
    model: string,
    prompt: string,
    options?: InvokeOptions
  ): Record<string, any> {
    if (model.includes('anthropic')) {
      // Claude Messages API format
      const body: Record<string, any> = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: options?.maxTokens || 4096,
        temperature: options?.temperature ?? 0.7,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      };

      if (options?.systemPrompt) {
        body.system = options.systemPrompt;
      }

      if (options?.stopSequences?.length) {
        body.stop_sequences = options.stopSequences;
      }

      return body;
    } else if (model.includes('meta')) {
      // Llama Messages API format
      return {
        prompt: options?.systemPrompt
          ? `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n${options.systemPrompt}<|eot_id|><|start_header_id|>user<|end_header_id|>\n${prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n`
          : `<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n${prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n`,
        max_gen_len: options?.maxTokens || 4096,
        temperature: options?.temperature ?? 0.7,
      };
    }

    throw new Error(`Unsupported model: ${model}`);
  }

  /**
   * Internal: Fallback to local Ollama for inference
   */
  private async _invokeOllama(
    prompt: string,
    complexity: TaskComplexity,
    options?: InvokeOptions
  ): Promise<string> {
    const ollamaEndpoint = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
    const ollamaModel = complexity === 'complex' ? 'codellama' : 'llama3';

    // Check if Ollama is available
    try {
      const healthCheck = await fetch(`${ollamaEndpoint}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!healthCheck.ok) {
        throw new Error('Ollama is not running');
      }
    } catch {
      throw new Error(
        `Ollama is not available at ${ollamaEndpoint}. ` +
        'Install Ollama from https://ollama.ai and run: ollama serve'
      );
    }

    // Invoke Ollama
    const response = await fetch(`${ollamaEndpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel,
        prompt: options?.systemPrompt
          ? `System: ${options.systemPrompt}\n\nUser: ${prompt}`
          : prompt,
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens || 4096,
          ...(options?.stopSequences?.length && { stop: options.stopSequences }),
        },
      }),
      signal: AbortSignal.timeout(120000), // 2 minute timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama request failed: ${errorText}`);
    }

    const data = await response.json();
    return data.response || '';
  }

  /**
   * Internal: Rough token count estimation (~4 chars per token)
   */
  private _estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
