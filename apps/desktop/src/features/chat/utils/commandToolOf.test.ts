import { describe, expect, it } from 'vitest';
import { nextProviderRunId } from '@goodboy/types/testing';
import { commandToolOf } from './commandToolOf';
import type { TranscriptItem } from './transcript-items';

type ToolItem = Extract<TranscriptItem, { kind: 'tool_call' }>;

const AT: ToolItem['startedAt'] = JSON.parse(JSON.stringify('2026-06-08T10:00:00.000Z'));

const toolOf = (overrides: Partial<ToolItem>): ToolItem => ({
  kind: 'tool_call',
  key: 'tool-1',
  toolUseId: '1',
  toolName: 'Bash',
  input: { command: 'pnpm --filter payments-api test' },
  output: null,
  isError: false,
  ended: true,
  runId: nextProviderRunId(),
  startedAt: AT,
  endedAt: AT,
  ...overrides,
});

describe('commandToolOf', () => {
  it('reads a Bash call whose result is a string', () => {
    expect(commandToolOf({ item: toolOf({ output: 'FAIL settlement.test.ts\n' }) })).toEqual({
      command: 'pnpm --filter payments-api test',
      output: 'FAIL settlement.test.ts\n',
      exitCode: null,
    });
  });

  it('joins text blocks of a result', () => {
    const item = toolOf({
      output: [
        { type: 'text', text: 'one' },
        { type: 'text', text: 'two' },
      ],
    });
    expect(commandToolOf({ item })?.output).toBe('one\ntwo');
  });

  it('reads the output and exit code of a shell call', () => {
    const item = toolOf({
      toolName: 'shell',
      input: { command: ['pnpm', 'test'] },
      output: { aggregated_output: 'FAIL postings\n', exit_code: 1 },
      isError: true,
    });
    expect(commandToolOf({ item })).toEqual({
      command: 'pnpm test',
      output: 'FAIL postings\n',
      exitCode: 1,
    });
  });

  it('puts stdout before stderr', () => {
    const item = toolOf({ output: { stdout: 'built', stderr: 'warn: slow', exitCode: 0 } });
    expect(commandToolOf({ item })).toEqual({
      command: 'pnpm --filter payments-api test',
      output: 'built\nwarn: slow',
      exitCode: 0,
    });
  });

  it('removes color codes from the output', () => {
    const item = toolOf({ output: '\u001B[31mFAIL\u001B[0m postings' });
    expect(commandToolOf({ item })?.output).toBe('FAIL postings');
  });

  it('has no output text for a call that has not ended', () => {
    expect(commandToolOf({ item: toolOf({ ended: false, endedAt: null }) })).toEqual({
      command: 'pnpm --filter payments-api test',
      output: null,
      exitCode: null,
    });
  });

  it('has no output text for a result it cannot read as text', () => {
    expect(commandToolOf({ item: toolOf({ output: { rows: [1, 2] } }) })?.output).toBeNull();
  });

  it('treats an ended call with no result as empty output', () => {
    expect(commandToolOf({ item: toolOf({ output: null }) })?.output).toBe('');
  });

  it('is nothing for a tool that is not a command or has no command text', () => {
    expect(commandToolOf({ item: toolOf({ toolName: 'Read', input: { path: '/a' } }) })).toBeNull();
    expect(commandToolOf({ item: toolOf({ input: { command: '  ' } }) })).toBeNull();
    expect(commandToolOf({ item: toolOf({ input: 'ls' }) })).toBeNull();
  });
});
