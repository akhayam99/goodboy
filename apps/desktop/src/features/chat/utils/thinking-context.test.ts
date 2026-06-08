import { describe, expect, it } from 'vitest';
import type { TranscriptItem } from './transcript-items';
import { classifyThinkingContext } from './thinking-context';

const toolCall = (toolName: string): TranscriptItem => ({
  kind: 'tool_call',
  key: `tool-${toolName}`,
  toolUseId: toolName,
  toolName,
  input: null,
  output: null,
  isError: false,
  ended: true,
});

describe('classifyThinkingContext', () => {
  it('defaults to think when there is no last item', () => {
    expect(classifyThinkingContext({ lastItem: undefined })).toBe('think');
  });

  it('treats reasoning and user turns as think', () => {
    const userText: TranscriptItem = {
      kind: 'user_text',
      key: 'u1',
      text: 'hi',
      at: '2026-06-09T10:00:00.000Z',
    } as TranscriptItem;
    expect(classifyThinkingContext({ lastItem: userText })).toBe('think');
  });

  it('maps file edits to edit', () => {
    const fileEdit: TranscriptItem = {
      kind: 'file_edit',
      key: 'f1',
      path: 'src/index.ts',
      editType: 'modify',
    };
    expect(classifyThinkingContext({ lastItem: fileEdit })).toBe('edit');
  });

  it('maps read-like tools to search', () => {
    expect(classifyThinkingContext({ lastItem: toolCall('Grep') })).toBe('search');
    expect(classifyThinkingContext({ lastItem: toolCall('Read') })).toBe('search');
  });

  it('maps write-like tools to edit', () => {
    expect(classifyThinkingContext({ lastItem: toolCall('Write') })).toBe('edit');
    expect(classifyThinkingContext({ lastItem: toolCall('apply_patch') })).toBe('edit');
  });

  it('falls back to run for shell or unknown tools', () => {
    expect(classifyThinkingContext({ lastItem: toolCall('Bash') })).toBe('run');
    expect(classifyThinkingContext({ lastItem: toolCall('some_mcp_thing') })).toBe('run');
  });
});
