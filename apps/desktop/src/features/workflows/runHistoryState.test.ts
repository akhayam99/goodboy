import { describe, expect, it } from 'vitest';
import type { WorkflowRunHistoryRow } from '@goodboy/db';
import { AUTO_BLOCK_TEXT } from '@goodboy/core/auto';
import { brandId, type AgentId } from '@goodboy/types';
import { runHistoryState } from './runHistoryState';
import { aRunHistoryRow } from './testing/aRunHistoryRow';

type Overrides = Partial<
  Omit<WorkflowRunHistoryRow, 'workflowRunId' | 'workflowId' | 'sessionId' | 'createdAt'>
>;

const runOf = (overrides: Overrides) => aRunHistoryRow({ overrides });

const DYNAMIC: Overrides = {
  executionMode: 'dynamic',
  stepCount: 0,
  startedSteps: 4,
  finishedSteps: 4,
};

describe('runHistoryState', () => {
  it('reads running before failed, failed before done', () => {
    expect(
      runHistoryState({ run: runOf({ startedSteps: 3, runningSteps: 1, failedSteps: 1 }) }).key,
    ).toBe('running');
    expect(runHistoryState({ run: runOf({ startedSteps: 2, failedSteps: 1 }) }).key).toBe('failed');
    expect(runHistoryState({ run: runOf({ startedSteps: 3, finishedSteps: 3 }) }).key).toBe('done');
  });

  it('calls an orchestrated run done only on its done outcome', () => {
    expect(runHistoryState({ run: runOf(DYNAMIC) }).key).toBe('waiting');
    expect(runHistoryState({ run: runOf({ ...DYNAMIC, orchestrationOutcome: 'done' }) }).key).toBe(
      'done',
    );
    expect(
      runHistoryState({ run: runOf({ ...DYNAMIC, orchestrationOutcome: 'blocked' }) }).key,
    ).toBe('failed');
  });

  it('names a stopped, an idle and a never started run', () => {
    expect(runHistoryState({ run: runOf({ startedSteps: 1, stoppedSteps: 1 }) }).label).toBe(
      'Stopped',
    );
    expect(runHistoryState({ run: runOf({ startedSteps: 1, finishedSteps: 1 }) }).label).toBe(
      'Needs you',
    );
    expect(runHistoryState({ run: runOf({}) }).label).toBe('Not started');
  });

  describe('a Lead run', () => {
    const leadRun = (lead: Partial<NonNullable<WorkflowRunHistoryRow['lead']>>) =>
      runOf({
        executionMode: 'dynamic',
        leadAgentId: brandId<AgentId>({ value: 'agent-lead' }),
        startedSteps: 3,
        finishedSteps: 3,
        lead: {
          phase: 'waiting',
          blockedReason: null,
          remainingUsd: null,
          isTurnLive: false,
          isAsking: false,
          ...lead,
        },
      });

    it('reads a resting Lead as idle and a finished Lead as done', () => {
      expect(runHistoryState({ run: leadRun({ phase: 'done' }) }).label).toBe('Idle');
      expect(runHistoryState({ run: leadRun({ phase: 'done', isTurnLive: true }) }).key).toBe(
        'running',
      );
      expect(runHistoryState({ run: leadRun({ phase: 'finished' }) }).key).toBe('done');
    });

    it('reads a budget pause as Needs you and any other block as failed', () => {
      expect(
        runHistoryState({
          run: leadRun({ phase: 'blocked', blockedReason: AUTO_BLOCK_TEXT.budget }),
        }).key,
      ).toBe('waiting');
      expect(
        runHistoryState({ run: leadRun({ phase: 'blocked', blockedReason: 'Tests did not pass' }) })
          .key,
      ).toBe('failed');
    });

    it('reads a Lead that spent its cap as Needs you', () => {
      expect(runHistoryState({ run: leadRun({ remainingUsd: 0 }) }).key).toBe('waiting');
    });

    it('reads a stopped tree as stopped even with completed agents', () => {
      expect(runHistoryState({ run: leadRun({ phase: 'stopped' }) }).key).toBe('stopped');
      expect(runHistoryState({ run: leadRun({ phase: 'stopping' }) }).key).toBe('stopped');
    });

    it('reads an open ask as Needs you and a working Lead as running', () => {
      expect(runHistoryState({ run: leadRun({ isAsking: true }) }).key).toBe('waiting');
      expect(runHistoryState({ run: leadRun({}) }).key).toBe('running');
    });
  });
});
