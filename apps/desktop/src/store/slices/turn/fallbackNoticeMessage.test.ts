import { describe, expect, it } from 'vitest';
import { modelLabel } from '../../../features/chat/utils/chat-constants';
import { fallbackNoticeMessage } from './fallbackNoticeMessage';

describe('fallbackNoticeMessage', () => {
  it('names an off-catalog model the way the footer does, not by its raw id', () => {
    const message = fallbackNoticeMessage({
      provider: 'codex',
      failure: 'authentication',
      plan: { provider: 'anthropic', model: 'claude-opus-5-9' },
    });

    expect(message).toContain(`anthropic ${modelLabel('claude-opus-5-9')}.`);
    expect(message).toContain('Opus 5.9');
    expect(message).not.toContain('claude-opus-5-9');
  });
});
