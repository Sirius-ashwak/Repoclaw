/**
 * Telegram Bot Integration
 * Sends artifacts to Telegram chat
 */

import { Artifact } from '@/types';

/**
 * Telegram Bot API configuration
 */
interface TelegramConfig {
  botToken: string;
  chatId: string;
}

/**
 * Send message to Telegram
 */
export async function sendTelegramMessage(
  config: TelegramConfig,
  message: string
): Promise<boolean> {
  const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    const data = await response.json();
    return data.ok === true;
  } catch (error) {
    console.error('Failed to send Telegram message:', error);
    return false;
  }
}

/**
 * Send document to Telegram
 */
export async function sendTelegramDocument(
  config: TelegramConfig,
  document: Blob,
  filename: string,
  caption?: string
): Promise<boolean> {
  const url = `https://api.telegram.org/bot${config.botToken}/sendDocument`;

  try {
    const formData = new FormData();
    formData.append('chat_id', config.chatId);
    formData.append('document', document, filename);
    if (caption) {
      formData.append('caption', caption);
    }

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    return data.ok === true;
  } catch (error) {
    console.error('Failed to send Telegram document:', error);
    return false;
  }
}

/**
 * Format artifacts for Telegram message
 */
export function formatArtifactsForTelegram(artifacts: Artifact[]): string {
  let message = '🚀 *RepoClaw Export*\n\n';
  message += `Generated: ${new Date().toLocaleString()}\n`;
  message += `Artifacts: ${artifacts.length}\n\n`;

  // Add PR link if available
  const prArtifact = artifacts.find((a) => a.type === 'pull-request');
  if (prArtifact && prArtifact.metadata?.prUrl) {
    message += `📝 *Pull Request*\n`;
    message += `[PR #${prArtifact.metadata.prNumber}](${prArtifact.metadata.prUrl})\n`;
    message += `${prArtifact.metadata.title}\n\n`;
  }

  // Add demo link if available
  const demoArtifact = artifacts.find((a) => a.type === 'demo-url');
  if (demoArtifact && demoArtifact.metadata?.url) {
    message += `🔗 *Live Demo*\n`;
    message += `${demoArtifact.metadata.url}\n\n`;
  }

  // List other artifacts
  const otherArtifacts = artifacts.filter(
    (a) => a.type !== 'pull-request' && a.type !== 'demo-url'
  );

  if (otherArtifacts.length > 0) {
    message += `📦 *Artifacts*\n`;
    for (const artifact of otherArtifacts) {
      message += `• ${artifact.title}\n`;
    }
  }

  return message;
}

/**
 * Send artifacts to Telegram
 */
export async function sendArtifactsToTelegram(
  chatId: string,
  artifacts: Artifact[]
): Promise<{ success: boolean; message: string }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return {
      success: false,
      message: 'Telegram bot token not configured',
    };
  }

  const config: TelegramConfig = { botToken, chatId };

  // Send summary message
  const summaryMessage = formatArtifactsForTelegram(artifacts);
  const messageSent = await sendTelegramMessage(config, summaryMessage);

  if (!messageSent) {
    return {
      success: false,
      message: 'Failed to send message to Telegram',
    };
  }

  // Send individual artifacts as documents
  let documentsSent = 0;
  for (const artifact of artifacts) {
    if (['readme', 'api-docs', 'pitch-deck', 'pitch-script'].includes(artifact.type)) {
      const blob = new Blob([artifact.content], { type: 'text/plain' });
      const filename = `${artifact.type}.txt`;
      const sent = await sendTelegramDocument(config, blob, filename, artifact.title);
      if (sent) {
        documentsSent++;
      }
    }
  }

  return {
    success: true,
    message: `Sent summary and ${documentsSent} document(s) to Telegram`,
  };
}

/**
 * Validate Telegram chat ID format
 */
export function validateTelegramChatId(chatId: string): {
  valid: boolean;
  message: string;
} {
  if (!chatId || chatId.trim().length === 0) {
    return {
      valid: false,
      message: 'Chat ID is required',
    };
  }

  // Chat ID should be numeric or start with @ for username
  if (!/^-?\d+$/.test(chatId) && !chatId.startsWith('@')) {
    return {
      valid: false,
      message: 'Invalid chat ID format. Use numeric ID or @username',
    };
  }

  return {
    valid: true,
    message: 'Valid chat ID',
  };
}

/**
 * Get Telegram bot info
 */
export async function getTelegramBotInfo(botToken: string): Promise<any> {
  const url = `https://api.telegram.org/bot${botToken}/getMe`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    return data.ok ? data.result : null;
  } catch (error) {
    console.error('Failed to get bot info:', error);
    return null;
  }
}

/**
 * Test Telegram connection
 */
export async function testTelegramConnection(
  chatId: string
): Promise<{ success: boolean; message: string }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return {
      success: false,
      message: 'Telegram bot token not configured',
    };
  }

  // Validate chat ID
  const validation = validateTelegramChatId(chatId);
  if (!validation.valid) {
    return {
      success: false,
      message: validation.message,
    };
  }

  // Test by sending a simple message
  const config: TelegramConfig = { botToken, chatId };
  const testMessage = '✅ RepoClaw connection test successful!';
  const sent = await sendTelegramMessage(config, testMessage);

  if (sent) {
    return {
      success: true,
      message: 'Connection test successful',
    };
  } else {
    return {
      success: false,
      message: 'Failed to send test message. Check bot token and chat ID.',
    };
  }
}
