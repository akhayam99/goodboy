import { describe, expect, it } from 'vitest';
import type { ProviderRunId } from '@goodboy/types';
import type { TranscriptItem } from '../chat/utils/transcript-items';
import { lastRunStep } from './lastRunStep';

type ToolCall = Extract<TranscriptItem, { kind: 'tool_call' }>;

const tool = (fields: Partial<ToolCall>): TranscriptItem => ({
  kind: 'tool_call',
  key: 'k',
  toolUseId: 'tu',
  toolName: 'Bash',
  input: { command: 'pnpm test src/webhooks' },
  output: null,
  isError: false,
  ended: true,
  runId: 'run-1' as ProviderRunId,
  startedAt: '2026-09-04T14:00:00.000Z' as ToolCall['startedAt'],
  endedAt: null,
  ...fields,
});

describe('lastRunStep', () => {
  it('reads the failing count from the output of the last command', () => {
    const step = lastRunStep({
      items: [tool({ isError: true, output: { stdout: 'Tests  2 failed | 8 passed' } })],
    });
    expect(step).toEqual({ command: 'pnpm test src/webhooks', result: '2 failing' });
  });

  it('says passed for a command that succeeded and failed when no count shows', () => {
    expect(lastRunStep({ items: [tool({})] })?.result).toBe('passed');
    expect(lastRunStep({ items: [tool({ isError: true, output: 'boom' })] })?.result).toBe(
      'failed',
    );
  });

  it('skips tool calls without a command and stays quiet when there is none', () => {
    const edit = tool({ toolName: 'Edit', input: { path: 'a.ts' } });
    expect(
      lastRunStep({ items: [tool({ input: { command: 'git status' } }), edit] })?.command,
    ).toBe('git status');
    expect(lastRunStep({ items: [edit] })).toBeNull();
  });

  it('marks a command the run never finished', () => {
    expect(lastRunStep({ items: [tool({ ended: false })] })?.result).toBe('did not finish');
  });
});
