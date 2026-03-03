/**
 * Translation Service
 * AWS Translate + Polly integration for vernacular language support
 * Supports Hindi, Tamil, Telugu, Bengali, Marathi with technical term preservation
 */

import {
  TranslateClient,
  TranslateTextCommand,
} from '@aws-sdk/client-translate';
import {
  PollyClient,
  SynthesizeSpeechCommand,
  OutputFormat,
  Engine,
  TextType,
} from '@aws-sdk/client-polly';
import { getAWSConfig } from './config';
import { S3ArtifactManager } from './s3';
import { createHash } from 'crypto';

export type SupportedLanguage = 'hi' | 'ta' | 'te' | 'bn' | 'mr' | 'en';

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  hi: 'Hindi',
  ta: 'Tamil',
  te: 'Telugu',
  bn: 'Bengali',
  mr: 'Marathi',
  en: 'English',
};

export const LANGUAGE_NATIVE_NAMES: Record<SupportedLanguage, string> = {
  hi: 'हिन्दी',
  ta: 'தமிழ்',
  te: 'తెలుగు',
  bn: 'বাংলা',
  mr: 'मराठी',
  en: 'English',
};

// AWS Translate language codes
const TRANSLATE_LANG_CODES: Record<SupportedLanguage, string> = {
  hi: 'hi',
  ta: 'ta',
  te: 'te',
  bn: 'bn',
  mr: 'mr',
  en: 'en',
};

// Polly voice mapping
const VOICE_MAP: Record<SupportedLanguage, { voiceId: string; engine: Engine }> = {
  hi: { voiceId: 'Kajal', engine: 'neural' as Engine },
  ta: { voiceId: 'Kajal', engine: 'neural' as Engine },
  te: { voiceId: 'Kajal', engine: 'neural' as Engine },
  bn: { voiceId: 'Kajal', engine: 'neural' as Engine },
  mr: { voiceId: 'Kajal', engine: 'neural' as Engine },
  en: { voiceId: 'Joanna', engine: 'neural' as Engine },
};

// Technical terms that should be preserved in English
const TECHNICAL_TERMS = [
  'API', 'REST', 'GraphQL', 'HTTP', 'HTTPS', 'URL', 'JSON', 'XML', 'HTML', 'CSS',
  'JavaScript', 'TypeScript', 'Python', 'Node.js', 'React', 'Next.js', 'Vue',
  'Angular', 'Express', 'Flask', 'FastAPI', 'Django', 'Spring', 'Docker',
  'Kubernetes', 'AWS', 'Lambda', 'S3', 'DynamoDB', 'EC2', 'ECS',
  'Git', 'GitHub', 'npm', 'yarn', 'pip', 'webpack', 'Vite',
  'MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'Elasticsearch',
  'function', 'class', 'interface', 'const', 'let', 'var', 'async', 'await',
  'import', 'export', 'return', 'throw', 'catch', 'try', 'finally',
  'OAuth', 'JWT', 'CORS', 'SSE', 'WebSocket', 'gRPC', 'SDK',
  'CI/CD', 'DevOps', 'YAML', 'TOML', 'ENV', 'CLI', 'IDE',
];

export interface TranslationConfig {
  region: string;
  customTerminologyName?: string;
}

interface CodeBlock {
  placeholder: string;
  content: string;
}

export class TranslationService {
  private translateClient: TranslateClient;
  private pollyClient: PollyClient;
  private s3Manager: S3ArtifactManager;
  private customTerminologyName?: string;

  constructor(config?: TranslationConfig) {
    const awsConfig = getAWSConfig();
    const translationConfig = config || {
      region: awsConfig.region,
      customTerminologyName: awsConfig.translate.customTerminologyName,
    };

    this.translateClient = new TranslateClient({
      region: translationConfig.region,
    });

    this.pollyClient = new PollyClient({
      region: translationConfig.region,
    });

    this.s3Manager = new S3ArtifactManager();
    this.customTerminologyName = translationConfig.customTerminologyName;
  }

  /**
   * Translate a document while preserving code blocks and technical terms
   */
  async translateDocument(
    content: string,
    sourceLang: SupportedLanguage,
    targetLang: SupportedLanguage,
    preserveCodeBlocks: boolean = true
  ): Promise<string> {
    // No translation needed if same language
    if (sourceLang === targetLang) {
      return content;
    }

    // Check cache first
    const contentHash = this._hashContent(content);
    const cached = await this.getCachedTranslation(contentHash, targetLang);
    if (cached) {
      return cached;
    }

    let processedContent = content;
    let codeBlocks: CodeBlock[] = [];

    // Extract code blocks before translation
    if (preserveCodeBlocks) {
      const extraction = this._extractCodeBlocks(processedContent);
      processedContent = extraction.text;
      codeBlocks = extraction.blocks;
    }

    // Protect technical terms with placeholders
    const { text: protectedText, termMap } = this._protectTechnicalTerms(processedContent);

    // Translate using AWS Translate
    // Split into chunks if content is too long (Translate has 5000 byte limit)
    const chunks = this._splitIntoChunks(protectedText, 4500);
    const translatedChunks: string[] = [];

    for (const chunk of chunks) {
      const command = new TranslateTextCommand({
        Text: chunk,
        SourceLanguageCode: TRANSLATE_LANG_CODES[sourceLang],
        TargetLanguageCode: TRANSLATE_LANG_CODES[targetLang],
        ...(this.customTerminologyName && {
          TerminologyNames: [this.customTerminologyName],
        }),
      });

      const response = await this.translateClient.send(command);
      translatedChunks.push(response.TranslatedText || chunk);
    }

    let translatedText = translatedChunks.join('');

    // Restore technical terms
    translatedText = this._restoreTechnicalTerms(translatedText, termMap);

    // Restore code blocks
    if (preserveCodeBlocks) {
      translatedText = this._restoreCodeBlocks(translatedText, codeBlocks);
    }

    // Cache the translation
    await this.cacheTranslation(contentHash, targetLang, translatedText);

    return translatedText;
  }

  /**
   * Generate audio from text using AWS Polly
   * Returns MP3 buffer with 30-60 second target duration
   */
  async generateAudioPitch(
    script: string,
    language: SupportedLanguage,
    voiceId?: string
  ): Promise<Buffer> {
    const voiceConfig = VOICE_MAP[language] || VOICE_MAP.en;
    const selectedVoice = voiceId || voiceConfig.voiceId;

    // Wrap in SSML for better pronunciation control
    const ssmlText = this._buildSSML(script, language);

    const command = new SynthesizeSpeechCommand({
      Text: ssmlText,
      TextType: 'ssml' as TextType,
      OutputFormat: 'mp3' as OutputFormat,
      VoiceId: selectedVoice,
      Engine: voiceConfig.engine,
      SampleRate: '22050',
    });

    const response = await this.pollyClient.send(command);

    if (!response.AudioStream) {
      throw new Error('Polly did not return an audio stream');
    }

    // Convert stream to Buffer
    const chunks: Uint8Array[] = [];
    const stream = response.AudioStream as any;

    if (typeof stream[Symbol.asyncIterator] === 'function') {
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
    } else if (stream instanceof Uint8Array || Buffer.isBuffer(stream)) {
      chunks.push(stream);
    } else {
      throw new Error('Unexpected audio stream type from Polly');
    }

    return Buffer.concat(chunks);
  }

  /**
   * Check for cached translation in S3
   */
  async getCachedTranslation(
    contentHash: string,
    targetLang: SupportedLanguage
  ): Promise<string | null> {
    try {
      const key = `translations/${contentHash}_${targetLang}.txt`;
      const artifacts = await this.s3Manager.listArtifacts('translations');

      const cached = artifacts.find((a) => a.key === key);
      if (!cached) return null;

      // Download cached translation
      // Note: We use the pre-signed URL to fetch
      const response = await fetch(cached.url);
      if (response.ok) {
        return await response.text();
      }
      return null;
    } catch {
      // Cache miss - not an error
      return null;
    }
  }

  /**
   * Cache a translation in S3
   */
  async cacheTranslation(
    contentHash: string,
    targetLang: SupportedLanguage,
    translation: string
  ): Promise<void> {
    try {
      const fileName = `${contentHash}_${targetLang}.txt`;
      await this.s3Manager.uploadArtifact(
        'translations',
        'pdf', // Using pdf type for text files
        fileName,
        Buffer.from(translation, 'utf-8'),
        { contentHash, targetLang, type: 'translation-cache' }
      );
    } catch {
      // Caching failure is non-critical - log but don't throw
      console.warn('Failed to cache translation');
    }
  }

  /**
   * Extract code blocks from markdown content and replace with placeholders
   */
  private _extractCodeBlocks(content: string): { text: string; blocks: CodeBlock[] } {
    const blocks: CodeBlock[] = [];
    let index = 0;

    // Match fenced code blocks (```...```)
    const processed = content.replace(/```[\s\S]*?```/g, (match) => {
      const placeholder = `__CODE_BLOCK_${index}__`;
      blocks.push({ placeholder, content: match });
      index++;
      return placeholder;
    });

    // Match inline code (`...`)
    const finalProcessed = processed.replace(/`[^`]+`/g, (match) => {
      const placeholder = `__INLINE_CODE_${index}__`;
      blocks.push({ placeholder, content: match });
      index++;
      return placeholder;
    });

    return { text: finalProcessed, blocks };
  }

  /**
   * Restore code blocks from placeholders
   */
  private _restoreCodeBlocks(text: string, blocks: CodeBlock[]): string {
    let restored = text;
    for (const block of blocks) {
      restored = restored.replace(block.placeholder, block.content);
    }
    return restored;
  }

  /**
   * Replace technical terms with placeholders to prevent translation
   */
  private _protectTechnicalTerms(
    text: string
  ): { text: string; termMap: Map<string, string> } {
    const termMap = new Map<string, string>();
    let processed = text;
    let index = 0;

    for (const term of TECHNICAL_TERMS) {
      // Use word boundary matching to avoid partial replacements
      const regex = new RegExp(`\\b${this._escapeRegex(term)}\\b`, 'g');
      if (regex.test(processed)) {
        const placeholder = `__TECH_TERM_${index}__`;
        termMap.set(placeholder, term);
        processed = processed.replace(regex, placeholder);
        index++;
      }
    }

    return { text: processed, termMap };
  }

  /**
   * Restore technical terms from placeholders
   */
  private _restoreTechnicalTerms(text: string, termMap: Map<string, string>): string {
    let restored = text;
    for (const [placeholder, term] of termMap) {
      restored = restored.split(placeholder).join(term);
    }
    return restored;
  }

  /**
   * Split text into chunks for AWS Translate (5000 byte limit)
   */
  private _splitIntoChunks(text: string, maxBytes: number): string[] {
    const encoder = new TextEncoder();
    const chunks: string[] = [];
    let currentChunk = '';

    const paragraphs = text.split('\n\n');

    for (const paragraph of paragraphs) {
      const testChunk = currentChunk ? `${currentChunk}\n\n${paragraph}` : paragraph;
      if (encoder.encode(testChunk).length > maxBytes && currentChunk) {
        chunks.push(currentChunk);
        currentChunk = paragraph;
      } else {
        currentChunk = testChunk;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks.length > 0 ? chunks : [text];
  }

  /**
   * Build SSML for Polly with pauses and emphasis
   */
  private _buildSSML(script: string, language: SupportedLanguage): string {
    // Add pauses after sentences and emphasis on key terms
    let ssml = script
      .replace(/\.\s+/g, '.<break time="500ms"/> ')
      .replace(/!\s+/g, '!<break time="300ms"/> ')
      .replace(/\?\s+/g, '?<break time="300ms"/> ');

    // Set language attribute
    const langCode = language === 'en' ? 'en-US' : `${language}-IN`;

    return `<speak><lang xml:lang="${langCode}">${ssml}</lang></speak>`;
  }

  /**
   * Hash content for cache key generation
   */
  private _hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  /**
   * Escape special regex characters
   */
  private _escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
