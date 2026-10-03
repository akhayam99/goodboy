// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type {
  ChatAttachmentId,
  ChatId,
  ChatMessage,
  ChatMessageId,
  IsoDateTime,
} from '@goodboy/types';
import { buildChatSystemPrompt } from './buildChatSystemPrompt';
import { buildChatTurnPrompt } from './buildChatTurnPrompt';

const AT = '2026-09-28T10:00:00.000Z' as IsoDateTime;

const message = (patch: Partial<ChatMessage>): ChatMessage => ({
  id: 'm' as ChatMessageId,
  chatId: 'chat' as ChatId,
  role: 'user',
  content: 'Where is the consent step defined?',
  status: 'done',
  reads: [],
  attachments: [],
  error: null,
  provider: null,
  model: null,
  effort: null,
  createdAt: AT,
  updatedAt: AT,
  ...patch,
});

describe('buildChatTurnPrompt', () => {
  it('names the images of earlier messages, even one sent without text', () => {
    const screenshot = {
      id: 'img' as ChatAttachmentId,
      chatId: 'chat' as ChatId,
      messageId: 'm' as ChatMessageId,
      position: 0,
      fileName: 'checkout-502.png',
      mimeType: 'image/png',
      byteSize: 2048,
      createdAt: AT,
    };
    const prompt = buildChatTurnPrompt({
      history: [
        message({ content: '', attachments: [screenshot] }),
        message({ role: 'assistant', content: 'The 502 comes from notify-relay.' }),
      ],
      question: 'And on Acme?',
    });
    expect(prompt.split('\n').slice(0, 3)).toEqual([
      'Earlier in this chat:',
      'User: (attached images: checkout-502.png)',
      'Assistant: The 502 comes from notify-relay.',
    ]);
  });

  it('sends the first question alone', () => {
    expect(buildChatTurnPrompt({ history: [], question: '  Why does notify-relay retry? ' })).toBe(
      'Why does notify-relay retry?',
    );
  });

  it('carries the earlier turns and drops failed answers', () => {
    const prompt = buildChatTurnPrompt({
      history: [
        message({}),
        message({ role: 'assistant', content: '**In payments-api.**' }),
        message({ content: 'And the version?' }),
        message({ role: 'assistant', content: 'provider exited', status: 'failed' }),
      ],
      question: 'Who reads it?',
    });
    expect(prompt).toBe(
      [
        'Earlier in this chat:',
        'User: Where is the consent step defined?',
        'Assistant: **In payments-api.**',
        'User: And the version?',
        '',
        'New question:',
        'Who reads it?',
      ].join('\n'),
    );
  });

  it('keeps the newest turns when the history is long', () => {
    const long = 'x'.repeat(10_000);
    const prompt = buildChatTurnPrompt({
      history: [
        message({ content: `first ${long}` }),
        message({ content: `second ${long}` }),
        message({ content: `third ${long}` }),
      ],
      question: 'Next',
    });
    expect(prompt).not.toContain('first');
    expect(prompt).toContain('second');
    expect(prompt).toContain('third');
  });
});

describe('buildChatSystemPrompt', () => {
  it('lists the projects and forbids every change', () => {
    const prompt = buildChatSystemPrompt({
      workspaceName: 'Harborline',
      projects: [
        { name: 'payments-api', rootPath: '/code/harborline/payments-api', description: null },
        {
          name: 'ledger-core',
          rootPath: '/code/harborline/ledger-core',
          description: 'Books every entry',
        },
      ],
    });
    expect(prompt).toContain('Harborline workspace');
    expect(prompt).toContain('- payments-api: /code/harborline/payments-api');
    expect(prompt).toContain('- ledger-core: /code/harborline/ledger-core | Books every entry');
    expect(prompt).toContain('You never change anything');
  });
});
