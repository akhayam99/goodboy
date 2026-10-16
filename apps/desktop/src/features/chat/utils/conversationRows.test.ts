// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProviderRunId } from '@goodboy/types';
import type { TranscriptItem } from './transcript-items';
import { conversationRows } from './conversationRows';
import { planChecklist } from './planChecklist';

const RUN: ProviderRunId = JSON.parse('"run-1"');
const AT: IsoDateTime = JSON.parse('"2026-09-14T15:08:00.000Z"');

const user = ({ key }: { readonly key: string }): TranscriptItem => ({
  kind: 'user_text',
  key,
  text: 'Reinstall dependencies in payments-api',
  at: AT,
});

const text = ({ key }: { readonly key: string }): TranscriptItem => ({
  kind: 'assistant_text',
  key,
  text: `answer ${key}`,
});

type ToolParams = {
  readonly key: string;
  readonly toolName?: string;
  readonly input?: unknown;
  readonly isEnded?: boolean;
};

const tool = ({
  key,
  toolName = 'Bash',
  input = {},
  isEnded = true,
}: ToolParams): TranscriptItem => ({
  kind: 'tool_call',
  key,
  toolUseId: key,
  toolName,
  input,
  output: null,
  isError: false,
  ended: isEnded,
  runId: RUN,
  startedAt: AT,
  endedAt: isEnded ? AT : null,
});

const usage = ({ key }: { readonly key: string }): TranscriptItem => ({
  kind: 'usage',
  key,
  runId: RUN,
  at: AT,
  usage: { inputTokens: 1, outputTokens: 1, cachedInputTokens: 0, estimatedCostUsd: 0.01 },
});

const kindsOf = ({
  items,
  isLive,
}: {
  readonly items: ReadonlyArray<TranscriptItem>;
  readonly isLive: boolean;
}) =>
  conversationRows({ items, isLive }).map((row) =>
    row.kind === 'item' ? `${row.item.kind}:${row.key}` : `${row.kind}:${row.key}`,
  );

describe('conversationRows', () => {
  it('keeps only the final answer under one summary line per finished turn', () => {
    const items = [
      user({ key: 'u1' }),
      text({ key: 'narration' }),
      tool({ key: 't1' }),
      text({ key: 'between' }),
      tool({ key: 't2' }),
      text({ key: 'final' }),
      usage({ key: 'f1' }),
    ];
    expect(kindsOf({ items, isLive: false })).toEqual([
      'user_text:u1',
      'summary:summary-t1',
      'assistant_text:final',
      'usage:f1',
    ]);
  });

  it('shows nothing of the live turn but its pending permission', () => {
    const items: ReadonlyArray<TranscriptItem> = [
      user({ key: 'u1' }),
      text({ key: 'narration' }),
      tool({ key: 't1', isEnded: false }),
      {
        kind: 'permission_request',
        key: 'p1',
        toolUseId: 't1',
        toolName: 'Bash',
        runId: RUN,
        input: { command: 'rm -rf node_modules' },
        at: AT,
      },
    ];
    expect(kindsOf({ items, isLive: true })).toEqual(['user_text:u1', 'permission_request:p1']);
  });

  it('places the plan checklist once, in the turn that first wrote it, before the footer', () => {
    const plan = (status: string): TranscriptItem =>
      tool({
        key: `plan-${status}`,
        toolName: 'TodoWrite',
        input: { todos: [{ content: 'Install with pnpm', status }] },
      });
    const items = [
      user({ key: 'u1' }),
      plan('in_progress'),
      text({ key: 'a1' }),
      usage({ key: 'f1' }),
      user({ key: 'u2' }),
      plan('completed'),
      text({ key: 'a2' }),
    ];
    const rows = kindsOf({ items, isLive: false });
    expect(rows).toEqual([
      'user_text:u1',
      'assistant_text:a1',
      'plan:plan-plan-in_progress',
      'usage:f1',
      'user_text:u2',
      'assistant_text:a2',
    ]);
    expect(planChecklist({ items })?.items).toEqual([{ text: 'Install with pnpm', state: 'done' }]);
  });

  it('reads the codex plan shape', () => {
    const items = [
      tool({
        key: 'p',
        toolName: 'update_plan',
        input: {
          plan: [
            { step: 'Read the export', status: 'completed' },
            { step: 'Batch rows', status: 'in_progress' },
            { step: 'Run tests', status: 'pending' },
          ],
        },
      }),
    ];
    expect(planChecklist({ items })?.items.map((item) => item.state)).toEqual([
      'done',
      'running',
      'todo',
    ]);
  });
});
