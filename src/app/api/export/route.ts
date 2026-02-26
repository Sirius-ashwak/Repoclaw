/**
 * POST /api/export
 * Handles artifact export in various formats (PDF, PR link, Telegram)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPipeline } from '@/lib/kv';
import type { ExportRequest, ExportResult } from '@/types';
import { generatePDF, validateArtifactsForPDF } from '@/lib/pdf-export';
import { extractPRUrl, validatePRArtifact, generateShareableMessage } from '@/lib/pr-export';
import { sendArtifactsToTelegram, validateTelegramChatId } from '@/lib/telegram-export';

export async function POST(request: NextRequest) {
  try {
    const body: ExportRequest = await request.json();
    const { pipelineId, format, options } = body;

    if (!pipelineId) {
      return NextResponse.json({ error: 'Pipeline ID is required' }, { status: 400 });
    }

    if (!format || !['pdf', 'pr-link', 'telegram'].includes(format)) {
      return NextResponse.json(
        { error: 'Valid format is required (pdf, pr-link, or telegram)' },
        { status: 400 }
      );
    }

    const pipeline = await getPipeline(pipelineId);
    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }

    if (pipeline.status !== 'completed') {
      return NextResponse.json(
        { error: 'Pipeline must be completed before exporting' },
        { status: 400 }
      );
    }

    let result: ExportResult;

    switch (format) {
      case 'pdf':
        result = await exportToPDF(pipeline);
        break;
      case 'pr-link':
        result = await exportPRLink(pipeline);
        break;
      case 'telegram':
        if (!options?.telegramChatId) {
          return NextResponse.json(
            { error: 'Telegram chat ID is required for Telegram export' },
            { status: 400 }
          );
        }
        result = await exportToTelegram(pipeline, options.telegramChatId);
        break;
      default:
        return NextResponse.json({ error: 'Invalid export format' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in /api/export:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function exportToPDF(pipeline: any): Promise<ExportResult> {
  try {
    const artifacts = pipeline.artifacts || [];
    
    // Validate artifacts
    const validation = validateArtifactsForPDF(artifacts);
    if (!validation.valid) {
      return {
        format: 'pdf',
        success: false,
        message: validation.message,
      };
    }

    // Generate PDF
    const pdfBlob = await generatePDF(artifacts);
    
    // In production, upload to storage and return URL
    // For now, return success with placeholder URL
    const url = URL.createObjectURL(pdfBlob);
    
    return {
      format: 'pdf',
      success: true,
      url,
      message: `PDF export successful with ${artifacts.length} artifact(s)`,
    };
  } catch (error) {
    console.error('PDF export error:', error);
    return {
      format: 'pdf',
      success: false,
      message: 'Failed to generate PDF',
    };
  }
}

async function exportPRLink(pipeline: any): Promise<ExportResult> {
  try {
    const artifacts = pipeline.artifacts || [];
    
    // Validate PR artifact
    const validation = validatePRArtifact(artifacts);
    if (!validation.valid) {
      return {
        format: 'pr-link',
        success: false,
        message: validation.message,
      };
    }

    // Extract PR URL
    const prUrl = extractPRUrl(artifacts);
    if (!prUrl) {
      return {
        format: 'pr-link',
        success: false,
        message: 'Failed to extract PR URL',
      };
    }

    // Generate shareable message
    const shareableMessage = generateShareableMessage(artifacts);

    return {
      format: 'pr-link',
      success: true,
      url: prUrl,
      message: shareableMessage || 'PR link retrieved successfully',
    };
  } catch (error) {
    console.error('PR link export error:', error);
    return {
      format: 'pr-link',
      success: false,
      message: 'Failed to export PR link',
    };
  }
}

async function exportToTelegram(pipeline: any, chatId: string): Promise<ExportResult> {
  try {
    // Validate chat ID
    const validation = validateTelegramChatId(chatId);
    if (!validation.valid) {
      return {
        format: 'telegram',
        success: false,
        message: validation.message,
      };
    }

    const artifacts = pipeline.artifacts || [];
    
    if (artifacts.length === 0) {
      return {
        format: 'telegram',
        success: false,
        message: 'No artifacts to send',
      };
    }

    // Send artifacts to Telegram
    const result = await sendArtifactsToTelegram(chatId, artifacts);

    return {
      format: 'telegram',
      success: result.success,
      message: result.message,
    };
  } catch (error) {
    console.error('Telegram export error:', error);
    return {
      format: 'telegram',
      success: false,
      message: 'Failed to send to Telegram',
    };
  }
}
