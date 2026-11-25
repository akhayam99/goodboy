// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearActionLedger } from './actionLedger';
import { MAX_RAISED_LIMIT_USD, clearRateSlots, limitOffersOf } from './actionLimits';
import { clearActionRegistry, mintActionId } from './actionRegistry';
import {
  AGENT,
  QUESTION_ID,
  QUESTION_VERSION,
  RUN,
  SESSION,
  WORKSPACE,
  buildTestStore,
  fixtureOf,
} from './decideTestKit';
import type { DecideAction, DecideKind } from './decideAction';
import { executeDecideAction } from './executeDecideAction';
import { clearLimitUndos } from './limitUndos';
import { parseDecideAction } from './parseDecideAction';
import { resetDecideScope } from './phoneScope';
import { transcriptEntriesOf } from './transcriptOf';
import type { TurnEvent } from '@goodboy/types';

type Raw = Readonly<Record<string, unknown>>;

const mint = ({ kind }: { readonly kind: DecideKind }): string =>
  mintActionId({ kind, workspaceId: WORKSPACE, sessionId: SESSION });

type ExecParams = {
  readonly kit: ReturnType<typeof buildTestStore>;
  readonly raw: Raw;
};

const exec = ({ kit, raw }: ExecParams) => {
  const action = parseDecideAction({ raw: { workspaceId: WORKSPACE, sessionId: SESSION, ...raw } });
  if (action === null) {
    throw new Error('test action did not parse');
  }
  return executeDecideAction({
    action,
    phoneId: 'phone-1',
    getStore: () => kit.store,
    ports: kit.ports,
  });
};

beforeEach(() => {
  clearActionLedger();
  clearActionRegistry();
  clearRateSlots();
  clearLimitUndos();
  resetDecideScope();
});

describe('the amounts a phone may raise a limit to', () => {
  it('offers only larger amounts, under the cap', () => {
    expect(limitOffersOf({ currentLimit: 10 })).toEqual([15, 20]);
    expect(limitOffersOf({ currentLimit: MAX_RAISED_LIMIT_USD })).toEqual([]);
  });

  it('refuses an amount the Mac did not offer', async () => {
    const kit = buildTestStore();
    const outcome = await exec({
      kit,
      raw: {
        kind: 'raiseLimit',
        actionId: mint({ kind: 'raiseLimit' }),
        runId: RUN,
        seenLimit: 10,
        offeredAmount: 9999,
      },
    });
    expect(outcome.refusal?.code).toBe('not-permitted');
    expect(kit.actions.setSessionBudget).not.toHaveBeenCalled();
  });

  it('undoes a raise and puts the old limit back', async () => {
    const kit = buildTestStore();
    const raised = await exec({
      kit,
      raw: {
        kind: 'raiseLimit',
        actionId: mint({ kind: 'raiseLimit' }),
        runId: RUN,
        seenLimit: 10,
        offeredAmount: 15,
      },
    });
    Object.assign(kit.store, {
      sessionBudgets: { [SESSION]: { softCapUsd: 15, onExceed: 'pause' } },
    });
    const done = await exec({
      kit,
      raw: {
        kind: 'undoRaiseLimit',
        actionId: raised.undoActionId ?? '',
        runId: RUN,
        raisedActionId: raised.actionId,
      },
    });
    expect(done.result).toBe('done');
    expect(kit.actions.setSessionBudget).toHaveBeenLastCalledWith(SESSION, 10, 'pause');
  });

  it('refuses the undo when the limit moved again', async () => {
    const kit = buildTestStore();
    const raised = await exec({
      kit,
      raw: {
        kind: 'raiseLimit',
        actionId: mint({ kind: 'raiseLimit' }),
        runId: RUN,
        seenLimit: 10,
        offeredAmount: 15,
      },
    });
    const outcome = await exec({
      kit,
      raw: {
        kind: 'undoRaiseLimit',
        actionId: raised.undoActionId ?? '',
        runId: RUN,
        raisedActionId: raised.actionId,
      },
    });
    expect(outcome.refusal?.code).toBe('version-changed');
  });
});

describe('what the executor remembers', () => {
  it('runs a failed action again when the phone retries with the same id', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const kit = buildTestStore();
    kit.actions.answerOpenQuestions.mockRejectedValueOnce(new Error('offline'));
    const raw = {
      kind: 'answerQuestion',
      actionId: mint({ kind: 'answerQuestion' }),
      questionId: QUESTION_ID,
      seenVersion: QUESTION_VERSION,
      text: 'EUR',
    };
    const first = await exec({ kit, raw });
    const retry = await exec({ kit, raw });
    expect({ first: first.result, retry: retry.result, replay: retry.isReplay }).toEqual({
      first: 'failed',
      retry: 'done',
      replay: false,
    });
  });

  it('refuses a second request with the same id while the first still runs', async () => {
    const kit = buildTestStore();
    let release: () => void = () => undefined;
    kit.actions.answerOpenQuestions.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const raw = {
      kind: 'answerQuestion',
      actionId: mint({ kind: 'answerQuestion' }),
      questionId: QUESTION_ID,
      seenVersion: QUESTION_VERSION,
      text: 'EUR',
    };
    const first = exec({ kit, raw });
    await vi.waitFor(() => expect(kit.actions.answerOpenQuestions).toHaveBeenCalled());
    const second = await exec({ kit, raw });
    release();
    await first;
    expect(second.refusal?.code).toBe('duplicate-in-flight');
  });

  it('says already decided for a permission answered on the Mac', async () => {
    const kit = buildTestStore({
      state: {
        agentTurnState: {},
        transcripts: {
          [AGENT]: [
            {
              kind: 'permission_decision',
              runId: 'provider-run-1',
              toolUseId: 'tool-use-1',
              decision: 'allow',
              ruleId: null,
              decidedBy: 'user',
              at: '2026-11-25T10:00:00.000Z',
            },
          ],
        },
      },
    });
    const outcome = await exec({
      kit,
      raw: {
        kind: 'answerPermission',
        actionId: mint({ kind: 'answerPermission' }),
        agentId: AGENT,
        requestId: 'tool-use-1',
        seenInputHash: 'x',
        verdict: 'deny',
      },
    });
    expect(outcome.refusal?.code).toBe('already-decided');
  });
});

describe('what the Mac accepts from the wire', () => {
  it('drops unknown fields and rejects a wrong type', () => {
    const base = {
      kind: 'stopAgent',
      actionId: 'a1',
      workspaceId: WORKSPACE,
      sessionId: SESSION,
      agentId: AGENT,
      seenState: 'running',
    };
    expect(parseDecideAction({ raw: { ...base, extra: 'x' } })).toEqual(base);
    expect(parseDecideAction({ raw: { ...base, seenState: 'sleeping' } })).toBeNull();
    expect(parseDecideAction({ raw: { ...base, kind: 'rmrf' } })).toBeNull();
  });

  it('rejects an answer longer than the cap', () => {
    const raw = {
      kind: 'answerQuestion',
      actionId: 'a1',
      workspaceId: WORKSPACE,
      sessionId: SESSION,
      questionId: QUESTION_ID,
      seenVersion: 'v',
      text: 'x'.repeat(4001),
    };
    expect(parseDecideAction({ raw })).toBeNull();
  });
});

describe('the transcript a phone reads', () => {
  it('merges words, keeps tools compact and never shows an absolute path', () => {
    const at = '2026-11-25T10:00:00.000Z';
    const entries = transcriptEntriesOf({
      events: fixtureOf<ReadonlyArray<TurnEvent>>({
        value: [
          { kind: 'user_text', runId: 'r', text: 'Fix it', at },
          { kind: 'assistant_text', runId: 'r', delta: 'Looking ', at },
          { kind: 'assistant_text', runId: 'r', delta: 'now.', at },
          {
            kind: 'tool_call_start',
            runId: 'r',
            toolUseId: 't1',
            toolName: 'Edit',
            input: {
              file_path: '/Users/maya/dev/ledger-core/credit.ts',
              old_string: 'a',
              new_string: 'a\nb',
            },
            at,
          },
          {
            kind: 'tool_call_start',
            runId: 'r',
            toolUseId: 't2',
            toolName: 'Bash',
            input: { command: 'cat /Users/maya/dev/ledger-core/notes.md' },
            at,
          },
        ],
      }),
    });
    expect(entries.map((entry) => entry.kind)).toEqual(['words', 'words', 'tool', 'tool']);
    expect(entries[1]).toMatchObject({ who: 'agent', text: 'Looking now.' });
    expect(entries[2]).toMatchObject({
      summary: 'Edited credit.ts',
      addedLines: 2,
      removedLines: 1,
    });
    expect(entries[3]).toMatchObject({ summary: 'cat .../notes.md' });
  });
});
