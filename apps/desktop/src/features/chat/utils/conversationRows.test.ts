// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProviderRunId } from '@goodboy/types';
import type { TranscriptItem } from './transcript-items';
import { conversationRows } from './conversationRows';
import { planChecklist } from './planChecklist';

const RUN: ProviderRunId = JSON.parse('"run-1"');
const AT: IsoDateTime = JSON.parse('"2026-09-14T15:08:00.000Z"');

type DockParams = {
  readonly ids: ReadonlyArray<string>;
};

const dockWith = ({ ids }: DockParams) => ({ openAskIds: new Set(ids), isAskLapsed: false });

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

  describe('with the dock', () => {
    const asked: TranscriptItem = {
      kind: 'permission_request',
      key: 'p1',
      toolUseId: 't1',
      toolName: 'Bash',
      runId: RUN,
      input: {},
      at: AT,
    };
    const decided: TranscriptItem = {
      kind: 'permission_decision',
      key: 'd1',
      toolUseId: 't1',
      toolName: 'Bash',
      runId: RUN,
      subject: 'rm -rf node_modules',
      decision: 'deny',
      scope: 'once',
      ruleId: null,
      decidedBy: 'user',
      reason: 'Do a dry run first',
      at: AT,
    };

    it('leaves a waiting permission to the dock', () => {
      expect(
        conversationRows({
          items: [asked],
          isLive: false,
          askDock: dockWith({ ids: ['t1'] }),
        }).some((row) => row.kind === 'item' && row.item.kind === 'permission_request'),
      ).toBe(false);
    });

    it('keeps the card of an ask the dock does not hold, as in a second window', () => {
      expect(
        conversationRows({ items: [asked], isLive: false, askDock: dockWith({ ids: [] }) }).some(
          (row) => row.kind === 'item' && row.item.kind === 'permission_request',
        ),
      ).toBe(true);
    });

    it('offers no card for an ask a stopped agent left behind', () => {
      expect(
        conversationRows({
          items: [asked],
          isLive: false,
          askDock: { openAskIds: new Set(), isAskLapsed: true },
        }).some((row) => row.kind === 'item' && row.item.kind === 'permission_request'),
      ).toBe(false);
    });

    it('offers no card for an ask a later message closed', () => {
      expect(
        conversationRows({
          items: [asked, user({ key: 'u2' })],
          isLive: false,
          askDock: dockWith({ ids: [] }),
        }).some((row) => row.kind === 'item' && row.item.kind === 'permission_request'),
      ).toBe(false);
    });

    it('keeps one record row for an answer the person gave', () => {
      const rows = conversationRows({
        items: [asked, decided],
        isLive: false,
        askDock: dockWith({ ids: [] }),
      });

      expect(rows.at(-1)).toMatchObject({ kind: 'item', key: 'd1' });
    });

    it('keeps no row for an answer a rule gave', () => {
      const rows = conversationRows({
        items: [{ ...decided, decidedBy: 'engine' }],
        isLive: false,
        askDock: dockWith({ ids: [] }),
      });

      expect(rows.some((row) => row.key === 'd1')).toBe(false);
    });
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
