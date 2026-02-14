/**
 * DemoAgent
 * Deploys live demos to Vercel and generates QR codes
 */

import { Agent } from './base';
import { Octokit } from '@octokit/rest';
import QRCode from 'qrcode';
import type {
  AgentType,
  AgentContext,
  AgentResult,
  DemoArtifact,
} from '@/types';

export class DemoAgent extends Agent {
  type: AgentType = 'demo';

  async execute(context: AgentContext): Promise<AgentResult> {
    const startTime = Date.now();
    
    try {
      this.log('Starting demo deployment');

      const octokit = new Octokit({ auth: context.githubToken });
      const { owner, name } = context.repoMetadata;

      // Validate build configuration
      const isValid = await this.validateBuildConfiguration(octokit, owner, name);
      
      if (!isValid) {
        this.log('Invalid build configuration, skipping deployment');
        
        const artifact: DemoArtifact = {
          id: `demo_${Date.now()}`,
          type: 'demo-url',
          title: 'Demo Deployment',
          content: 'Build configuration validation failed',
          metadata: {
            url: '',
            deploymentId: '',
            qrCode: '',
            status: 'failed',
            logs: ['Build configuration validation failed. Ensure package.json has a build script.'],
          },
          createdAt: Date.now(),
        };

        return this.createSuccessResult([artifact], { skipped: true }, Date.now() - startTime);
      }

      // Create Vercel deployment
      const deployment = await this.createVercelDeployment(context.repoMetadata);

      // Poll deployment status
      const deploymentStatus = await this.pollDeploymentStatus(deployment.id);

      if (deploymentStatus.status === 'failed') {
        const artifact: DemoArtifact = {
          id: `demo_${Date.now()}`,
          type: 'demo-url',
          title: 'Demo Deployment',
          content: 'Deployment failed',
          metadata: {
            url: deployment.url,
            deploymentId: deployment.id,
            qrCode: '',
            status: 'failed',
            logs: deploymentStatus.logs,
          },
          createdAt: Date.now(),
        };

        return this.createSuccessResult([artifact], { failed: true }, Date.now() - startTime);
      }

      // Validate deployment accessibility
      const isAccessible = await this.validateDeploymentAccessibility(deployment.url);

      if (!isAccessible) {
        this.log('Deployment not accessible');
      }

      // Generate QR code
      const qrCode = await this.generateQRCode(deployment.url);

      // Create demo artifact
      const artifact: DemoArtifact = {
        id: `demo_${Date.now()}`,
        type: 'demo-url',
        title: 'Live Demo',
        content: `Demo deployed successfully: ${deployment.url}`,
        metadata: {
          url: deployment.url,
          deploymentId: deployment.id,
          qrCode,
          status: 'ready',
          logs: deploymentStatus.logs,
        },
        createdAt: Date.now(),
      };

      this.log('Demo deployment complete', { url: deployment.url });

      return this.createSuccessResult([artifact], {}, Date.now() - startTime);
    } catch (error) {
      this.logError('Demo deployment failed', error);
      return this.createErrorResult(error, Date.now() - startTime);
    }
  }

  /**
   * Validate build configuration
   */
  private async validateBuildConfiguration(
    octokit: Octokit,
    owner: string,
    repo: string
  ): Promise<boolean> {
    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path: 'package.json',
      });

      if ('content' in data && data.content) {
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        const packageJson = JSON.parse(content);

        // Check for build script
        const hasBuildScript = packageJson.scripts && 'build' in packageJson.scripts;

        // Check for required dependencies (basic validation)
        const dependencies = Object.keys(packageJson.dependencies || {});
        const hasFramework = dependencies.some(dep => 
          ['next', 'react', 'vue', 'express'].includes(dep)
        );

        return hasBuildScript && hasFramework;
      }

      return false;
    } catch (error) {
      this.logError('Error validating build configuration', error);
      return false;
    }
  }

  /**
   * Create Vercel deployment
   */
  private async createVercelDeployment(repoMetadata: any): Promise<{
    id: string;
    url: string;
  }> {
    const vercelToken = process.env.VERCEL_TOKEN;
    const vercelTeamId = process.env.VERCEL_TEAM_ID;

    if (!vercelToken) {
      throw new Error('Vercel token not configured');
    }

    const { owner, name } = repoMetadata;

    // Create deployment via Vercel API
    const response = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vercelToken}`,
        'Content-Type': 'application/json',
        ...(vercelTeamId && { 'X-Vercel-Team-Id': vercelTeamId }),
      },
      body: JSON.stringify({
        name: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        gitSource: {
          type: 'github',
          repo: `${owner}/${name}`,
          ref: repoMetadata.defaultBranch || 'main',
        },
        target: 'preview',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Vercel deployment failed: ${error}`);
    }

    const data = await response.json();

    return {
      id: data.id,
      url: `https://${data.url}`,
    };
  }

  /**
   * Poll deployment status
   */
  private async pollDeploymentStatus(
    deploymentId: string,
    maxAttempts: number = 30,
    interval: number = 10000
  ): Promise<{ status: 'ready' | 'failed'; logs: string[] }> {
    const vercelToken = process.env.VERCEL_TOKEN;
    const vercelTeamId = process.env.VERCEL_TEAM_ID;

    const logs: string[] = [];

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(`https://api.vercel.com/v13/deployments/${deploymentId}`, {
          headers: {
            'Authorization': `Bearer ${vercelToken}`,
            ...(vercelTeamId && { 'X-Vercel-Team-Id': vercelTeamId }),
          },
        });

        if (!response.ok) {
          logs.push(`Failed to fetch deployment status: ${response.statusText}`);
          continue;
        }

        const data = await response.json();

        logs.push(`Deployment status: ${data.readyState}`);

        if (data.readyState === 'READY') {
          return { status: 'ready', logs };
        }

        if (data.readyState === 'ERROR' || data.readyState === 'CANCELED') {
          logs.push(`Deployment failed with state: ${data.readyState}`);
          return { status: 'failed', logs };
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, interval));
      } catch (error) {
        logs.push(`Error polling deployment: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    logs.push('Deployment timeout - exceeded maximum polling attempts');
    return { status: 'failed', logs };
  }

  /**
   * Validate deployment accessibility
   */
  private async validateDeploymentAccessibility(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
      });

      return response.ok && response.status === 200;
    } catch (error) {
      this.logError('Error validating deployment accessibility', error);
      return false;
    }
  }

  /**
   * Generate QR code for demo URL
   */
  private async generateQRCode(url: string): Promise<string> {
    try {
      // Generate QR code as base64-encoded data URL
      const qrCodeDataUrl = await QRCode.toDataURL(url, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 300,
        margin: 2,
      });

      return qrCodeDataUrl;
    } catch (error) {
      this.logError('Error generating QR code', error);
      return '';
    }
  }
}
