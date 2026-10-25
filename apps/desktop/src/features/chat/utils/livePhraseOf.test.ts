// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type IsoDateTime, type ProviderRunId } from '@goodboy/types';
import { livePhraseOf } from './livePhraseOf';
import type { TranscriptItem } from './transcript-items';

const RUN = brandId<ProviderRunId>({ value: 'run-harborline' });
const AT = brandId<IsoDateTime>({ value: '2026-10-24T09:00:00.000Z' });

type ToolParams = {
  readonly toolName: string;
  readonly input: unknown;
  readonly isEnded?: boolean;
};

const toolCall = ({ toolName, input, isEnded = false }: ToolParams): TranscriptItem => ({
  kind: 'tool_call',
  key: `tool-${toolName}`,
  toolUseId: toolName,
  toolName,
  input,
  output: null,
  isError: false,
  ended: isEnded,
  runId: RUN,
  startedAt: AT,
  endedAt: isEnded ? AT : null,
});

describe('livePhraseOf', () => {
  it('names the command and the project of the open tool', () => {
    const lastItem = toolCall({ toolName: 'Bash', input: { command: 'pnpm test --filter api' } });

    expect(livePhraseOf({ lastItem, project: 'payments-api' })).toBe(
      'Running pnpm in payments-api',
    );
  });

  it('names the file of a read or an edit', () => {
    expect(
      livePhraseOf({
        lastItem: toolCall({ toolName: 'Read', input: { file_path: 'src/webhook.ts' } }),
        project: null,
      }),
    ).toBe('Reading webhook.ts');
    expect(
      livePhraseOf({
        lastItem: { kind: 'file_edit', key: 'edit-1', path: 'src/ledger.ts', editType: 'modify' },
        project: null,
      }),
    ).toBe('Editing ledger.ts');
  });

  it('says the model writes when the last thing is its own text', () => {
    const lastItem: TranscriptItem = { kind: 'assistant_text', key: 'text-1', text: 'Done.' };

    expect(livePhraseOf({ lastItem, project: null })).toBe('Writing the answer');
  });

  it('says thinking when nothing runs, after a finished tool, and before the first event', () => {
    const ended = toolCall({ toolName: 'Bash', input: { command: 'ls' }, isEnded: true });

    expect(livePhraseOf({ lastItem: ended, project: null })).toBe('Thinking');
    expect(livePhraseOf({ lastItem: undefined, project: null })).toBe('Thinking');
  });
});
