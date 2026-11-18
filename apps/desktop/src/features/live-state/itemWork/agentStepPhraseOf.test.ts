// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { TurnEvent } from '@goodboy/types';
import { TEST_NOW, nextProviderRunId } from '@goodboy/types/testing';
import { agentStepPhraseOf } from './agentStepPhraseOf';

const runId = nextProviderRunId();

type ToolParams = {
  readonly id: string;
  readonly name: string;
  readonly input: unknown;
};

type IdParams = {
  readonly id: string;
};

type TextParams = {
  readonly delta: string;
};

const toolStart = ({ id, name, input }: ToolParams): TurnEvent => ({
  kind: 'tool_call_start',
  runId,
  toolUseId: id,
  toolName: name,
  input,
  at: TEST_NOW,
});

const toolEnd = ({ id }: IdParams): TurnEvent => ({
  kind: 'tool_call_end',
  runId,
  toolUseId: id,
  output: null,
  isError: false,
  at: TEST_NOW,
});

const text = ({ delta }: TextParams): TurnEvent => ({
  kind: 'assistant_text',
  runId,
  delta,
  at: TEST_NOW,
});

describe('agentStepPhraseOf', () => {
  it('reads an open Read as the file it reads', () => {
    const transcript = [
      toolStart({ id: 't1', name: 'Read', input: { file_path: 'src/webhooks/retryPolicy.ts' } }),
    ];

    expect(agentStepPhraseOf({ transcript })).toBe('Reading retryPolicy.ts');
  });

  it('reads an open Edit as the file it edits', () => {
    const transcript = [
      toolStart({ id: 't1', name: 'Read', input: { file_path: 'src/webhooks/config.ts' } }),
      toolEnd({ id: 't1' }),
      toolStart({ id: 't2', name: 'Edit', input: { file_path: 'src/webhooks/config.ts' } }),
    ];

    expect(agentStepPhraseOf({ transcript })).toBe('Editing config.ts');
  });

  it('reads an open Bash as the first line of its command', () => {
    const transcript = [
      toolStart({ id: 't1', name: 'Bash', input: { command: 'pnpm test retryPolicy\necho done' } }),
    ];

    expect(agentStepPhraseOf({ transcript })).toBe('Running pnpm test retryPolicy');
  });

  it('reads text as its last line, without list marks or a trailing colon', () => {
    const transcript = [
      toolStart({ id: 't1', name: 'Read', input: { file_path: 'src/webhooks/metrics.ts' } }),
      toolEnd({ id: 't1' }),
      text({ delta: 'The loop never reports.\n\n- Adding the ' }),
      text({ delta: '`retry_backoff_exhausted` metric:' }),
    ];

    expect(agentStepPhraseOf({ transcript })).toBe('Adding the retry_backoff_exhausted metric');
  });

  it('keeps a number that starts a sentence', () => {
    const transcript = [text({ delta: '3 attempts is the cap in config.ts' })];

    expect(agentStepPhraseOf({ transcript })).toBe('3 attempts is the cap in config.ts');
  });

  it('says Thinking after a finished tool and before any text', () => {
    const transcript = [
      toolStart({ id: 't1', name: 'Bash', input: { command: 'git status' } }),
      toolEnd({ id: 't1' }),
    ];

    expect(agentStepPhraseOf({ transcript })).toBe('Thinking');
  });

  it('says the agent writes when its text has no words yet', () => {
    expect(agentStepPhraseOf({ transcript: [text({ delta: '\n  \n' })] })).toBe(
      'Writing the answer',
    );
  });
});
