// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProviderRunId } from '@goodboy/types';
import type { TranscriptItem } from './transcript-items';
import { turnSummary } from './turnSummary';

const RUN: ProviderRunId = JSON.parse('"run-1"');
const AT: IsoDateTime = JSON.parse('"2026-09-14T15:08:00.000Z"');

type ToolParams = {
  readonly id: string;
  readonly toolName: string;
  readonly input?: unknown;
  readonly isError?: boolean;
};

const tool = ({ id, toolName, input = {}, isError = false }: ToolParams): TranscriptItem => ({
  kind: 'tool_call',
  key: `tool-${id}`,
  toolUseId: id,
  toolName,
  input,
  output: null,
  isError,
  ended: true,
  runId: RUN,
  startedAt: AT,
  endedAt: AT,
});

const read = ({ id, path }: { readonly id: string; readonly path: string }) =>
  tool({ id, toolName: 'Read', input: { file_path: path } });

const bash = ({ id, isError = false }: { readonly id: string; readonly isError?: boolean }) =>
  tool({ id, toolName: 'Bash', input: { command: 'pnpm test' }, isError });

describe('turnSummary', () => {
  it('says nothing for a turn without tools', () => {
    expect(turnSummary({ steps: [] })).toBeNull();
  });

  it('names one file read and counts commands', () => {
    const summary = turnSummary({
      steps: [read({ id: '1', path: '/repo/payments-api/brief.txt' }), bash({ id: '2' })],
    });
    expect(summary?.text).toBe('Read brief.txt, ran a command');
    expect(summary?.errorCount).toBe(0);
  });

  it('counts distinct files and appends the error count to the title', () => {
    const summary = turnSummary({
      steps: [
        read({ id: '1', path: 'a.ts' }),
        read({ id: '2', path: 'b.ts' }),
        read({ id: '3', path: 'a.ts' }),
        bash({ id: '4' }),
        bash({ id: '5', isError: true }),
        bash({ id: '6', isError: true }),
      ],
    });
    expect(summary?.text).toBe('Read 2 files, ran 3 commands');
    expect(summary?.title).toBe('Read 2 files, ran 3 commands (2 errors)');
    expect(summary?.errorCount).toBe(2);
  });

  it('puts unknown tools last as used', () => {
    const summary = turnSummary({
      steps: [
        tool({ id: '1', toolName: 'mcp__linear__get_issue' }),
        tool({ id: '2', toolName: 'Grep' }),
        tool({ id: '3', toolName: 'Grep' }),
        tool({ id: '4', toolName: 'mcp__linear__list' }),
      ],
    });
    expect(summary?.text).toBe('Searched the code 2 times, used 2 tools');
  });

  it('skips plan updates', () => {
    expect(
      turnSummary({ steps: [tool({ id: '1', toolName: 'TodoWrite', input: { todos: [] } })] }),
    ).toBeNull();
  });

  it('merges file edit records with edit tools by path', () => {
    const summary = turnSummary({
      steps: [
        tool({ id: '1', toolName: 'Edit', input: { file_path: '/r/export.ts' } }),
        { kind: 'file_edit', key: 'edit-1', path: '/r/export.ts', editType: 'modify' },
      ],
    });
    expect(summary?.text).toBe('Edited export.ts');
  });

  it('folds the fourth named clause into used', () => {
    const summary = turnSummary({
      steps: [
        bash({ id: '1' }),
        read({ id: '2', path: 'a.ts' }),
        tool({ id: '3', toolName: 'Grep' }),
        tool({ id: '4', toolName: 'WebSearch' }),
      ],
    });
    expect(summary?.text).toBe('Ran a command, read a.ts, searched the code, used a tool');
  });

  it('drops file names before folding clauses when the line is too long', () => {
    const summary = turnSummary({
      steps: [
        read({ id: '1', path: 'ledgerExportBatching.ts' }),
        tool({ id: '2', toolName: 'Edit', input: { file_path: 'ledgerExportScheduler.ts' } }),
        bash({ id: '3' }),
      ],
    });
    expect(summary?.text).toBe('Read a file, edited a file, ran a command');
  });

  it('never names a file longer than the limit', () => {
    const summary = turnSummary({
      steps: [read({ id: '1', path: 'averyveryverylongfilename_export.ts' })],
    });
    expect(summary?.text).toBe('Read a file');
  });
});
