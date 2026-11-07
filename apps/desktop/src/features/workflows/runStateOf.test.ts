// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { runGlanceOf } from '../session/glance/runGlanceOf';
import type { RunPrimaryKind } from './runPrimaryOf';
import {
  runStateFromKind,
  runStateOfPrimary,
  type RunState,
  type RunStateKind,
} from './runStateOf';

type Expected = Pick<RunState, 'word' | 'pageWord' | 'tone' | 'primary' | 'isNeedsYou' | 'wait'>;

const ROWS: Readonly<Record<RunStateKind, Expected>> = {
  archived: {
    word: 'Archived',
    pageWord: 'Archived',
    tone: 'idle',
    primary: 'restore',
    isNeedsYou: false,
    wait: null,
  },
  closed: {
    word: 'Stopped',
    pageWord: 'Stopped',
    tone: 'idle',
    primary: null,
    isNeedsYou: false,
    wait: null,
  },
  done: {
    word: 'Done',
    pageWord: 'Done',
    tone: 'done',
    primary: null,
    isNeedsYou: false,
    wait: null,
  },
  paused: {
    word: 'Paused',
    pageWord: 'Paused',
    tone: 'idle',
    primary: 'resume',
    isNeedsYou: false,
    wait: null,
  },
  'plan-hold': {
    word: 'Needs approval',
    pageWord: 'Needs approval',
    tone: 'needsYou',
    primary: null,
    isNeedsYou: true,
    wait: null,
  },
  'plan-revising': {
    word: 'Running',
    pageWord: 'Running',
    tone: 'running',
    primary: null,
    isNeedsYou: false,
    wait: null,
  },
  stopping: {
    word: 'Stopping',
    pageWord: 'Stopping',
    tone: 'running',
    primary: null,
    isNeedsYou: false,
    wait: null,
  },
  stopped: {
    word: 'Stopped',
    pageWord: 'Stopped',
    tone: 'idle',
    primary: 'continue',
    isNeedsYou: false,
    wait: null,
  },
  limit: {
    word: 'Paused at the limit',
    pageWord: 'Paused at the limit',
    tone: 'needsYou',
    primary: 'raise-cap',
    isNeedsYou: true,
    wait: 'limit',
  },
  'failed-stop': {
    word: 'Failed',
    pageWord: 'Failed',
    tone: 'failed',
    primary: 'retry',
    isNeedsYou: false,
    wait: 'stopped',
  },
  failed: {
    word: 'Failed',
    pageWord: 'Failed',
    tone: 'failed',
    primary: 'retry',
    isNeedsYou: false,
    wait: null,
  },
  running: {
    word: 'Running',
    pageWord: 'Running',
    tone: 'running',
    primary: null,
    isNeedsYou: false,
    wait: null,
  },
  question: {
    word: 'Needs you',
    pageWord: 'Needs you',
    tone: 'needsYou',
    primary: 'answer',
    isNeedsYou: true,
    wait: null,
  },
  'halted-blocked': {
    word: 'Not finished',
    pageWord: 'Needs you',
    tone: 'needsYou',
    primary: 'open-step',
    isNeedsYou: true,
    wait: 'stopped',
  },
  'halted-failed': {
    word: 'Failed',
    pageWord: 'Needs you',
    tone: 'failed',
    primary: 'open-step',
    isNeedsYou: false,
    wait: 'stopped',
  },
  'after-run': {
    word: 'After previous',
    pageWord: 'After previous',
    tone: 'idle',
    primary: null,
    isNeedsYou: false,
    wait: null,
  },
  ready: {
    word: 'Ready',
    pageWord: 'Ready',
    tone: 'idle',
    primary: null,
    isNeedsYou: false,
    wait: null,
  },
  'waits-go': {
    word: 'Waits for you',
    pageWord: 'Waits for you',
    tone: 'needsYou',
    primary: 'decide-next',
    isNeedsYou: true,
    wait: 'go',
  },
};

const KINDS = Object.keys(ROWS) as ReadonlyArray<RunStateKind>;

const PRIMARIES = [
  'review-plan',
  'approve-plan',
  'answer',
  'resume',
  'continue',
  'retry',
  'hint',
  'raise-cap',
  'decide-next',
  'start-step',
  'open-step',
  'start-run',
  'restore',
] as const satisfies ReadonlyArray<RunPrimaryKind>;

describe('runStateOf', () => {
  it.each(KINDS)('reads %s as one word, tone, primary and wait', (kind) => {
    expect(runStateFromKind({ kind })).toMatchObject(ROWS[kind]);
  });

  it('names the run it follows', () => {
    expect(runStateFromKind({ kind: 'after-run', predecessorName: 'Export ledger' }).word).toBe(
      'After Export ledger',
    );
  });

  it('keeps a halted step, blocked or failed, on the run page as the one word Needs you', () => {
    for (const kind of ['halted-blocked', 'halted-failed'] as const) {
      expect(runStateFromKind({ kind }).pageWord).toBe('Needs you');
      expect(runStateFromKind({ kind }).primary).toBe('open-step');
    }
  });

  it.each([
    ['answer', 'question'],
    ['open-step', 'halted-blocked'],
    ['raise-cap', 'limit'],
    ['retry', 'failed'],
    ['continue', 'stopped'],
  ] as const)('maps the %s primary to the %s state', (primary, kind) => {
    expect(runStateOfPrimary({ primary }).kind).toBe(kind);
  });

  it.each(PRIMARIES)(
    'lets the glance of the %s primary wait only when the run needs you',
    (primary) => {
      const glance = runGlanceOf({
        isDiscarded: false,
        isCompleted: false,
        isDynamic: true,
        doneCount: 1,
        stepCount: 0,
        primary,
      });

      if (glance.state === 'waiting') {
        expect(runStateOfPrimary({ primary }).isNeedsYou).toBe(true);
      }
    },
  );
});
