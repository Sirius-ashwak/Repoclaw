/**
 * POST /api/export
 * Handles artifact export in various formats (PDF, PR link, Telegram)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPipeline } from '@/lib/kv';
import type { ExportRequest, ExportResult } from '@/types';

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
  // TODO: Implement PDF generation using pdf-lib or similar
  // Bundle README, API docs, pitch deck into PDF
  return {
    format: 'pdf',
    success: true,
    url: '/exports/placeholder.pdf',
    message: 'PDF export successful (placeholder)',
  };
}

async function exportPRLink(pipeline: any): Promise<ExportResult> {
  const prArtifact = pipeline.artifacts.find((a: any) => a.type === 'pull-request');
  
  if (!prArtifact || !prArtifact.metadata?.prUrl) {
    return {
      format: 'pr-link',
      success: false,
      message: 'No pull request found in pipeline artifacts',
    };
  }

  return {
    format: 'pr-link',
    success: true,
    url: prArtifact.metadata.prUrl,
    message: 'PR link retrieved successfully',
  };
}

async function exportToTelegram(pipeline: any, chatId: string): Promise<ExportResult> {
  // TODO: Implement Telegram bot integration
  // Send artifacts as messages/files to specified chat
  return {
    format: 'telegram',
    success: true,
    message: `Artifacts sent to Telegram chat ${chatId} (placeholder)`,
  };
}
