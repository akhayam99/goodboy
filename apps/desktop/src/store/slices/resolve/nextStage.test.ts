import { describe, expect, it } from 'vitest';
import type { ResolveStage } from '@goodboy/types';
import { nextStage, type ResolveStageEvent } from './nextStage';

const STAGES: ReadonlyArray<ResolveStage> = [
  'new',
  'working',
  'asking',
  'proposed',
  'approved',
  'publishing',
  'failed',
  'parked',
  'resolved',
];

const EVENTS: ReadonlyArray<ResolveStageEvent> = [
  { kind: 'run_started' },
  { kind: 'run_asked' },
  { kind: 'run_reported' },
  { kind: 'run_failed' },
  { kind: 'run_stopped' },
  { kind: 'user_answered' },
  { kind: 'user_approved' },
  { kind: 'user_unapproved' },
  { kind: 'comment_edited' },
  { kind: 'user_parked' },
  { kind: 'user_resumed', hasProposal: true },
  { kind: 'user_resumed', hasProposal: false },
  { kind: 'publish_started' },
  { kind: 'delivered' },
  { kind: 'step_failed' },
  { kind: 'interrupted' },
  { kind: 'retry', target: 'run' },
  { kind: 'retry', target: 'publishing' },
  { kind: 'github_resolved' },
  { kind: 'github_reopened', hasProposal: true },
  { kind: 'github_reopened', hasProposal: false },
];

const label = (event: ResolveStageEvent): string => {
  if (event.kind === 'user_resumed' || event.kind === 'github_reopened') {
    return `${event.kind}:${event.hasProposal ? 'proposal' : 'empty'}`;
  }
  if (event.kind === 'retry') {
    return `retry:${event.target}`;
  }
  return event.kind;
};

const MOVES: Readonly<Record<ResolveStage, Readonly<Record<string, ResolveStage>>>> = {
  new: {
    run_started: 'working',
    run_asked: 'asking',
    run_reported: 'proposed',
    user_approved: 'approved',
    user_parked: 'parked',
  },
  working: {
    run_asked: 'asking',
    run_reported: 'proposed',
    run_failed: 'failed',
    run_stopped: 'new',
  },
  asking: {
    user_answered: 'working',
    run_started: 'working',
    run_reported: 'proposed',
    run_failed: 'failed',
    run_stopped: 'new',
    user_parked: 'parked',
  },
  proposed: {
    user_approved: 'approved',
    run_started: 'working',
    run_asked: 'asking',
    run_reported: 'proposed',
    comment_edited: 'proposed',
    user_parked: 'parked',
  },
  approved: {
    publish_started: 'publishing',
    user_unapproved: 'proposed',
    comment_edited: 'proposed',
    run_started: 'working',
  },
  publishing: {
    delivered: 'resolved',
    step_failed: 'failed',
    interrupted: 'failed',
  },
  failed: {
    'retry:run': 'working',
    'retry:publishing': 'publishing',
    run_started: 'working',
    publish_started: 'publishing',
    run_reported: 'proposed',
    user_approved: 'approved',
    user_parked: 'parked',
  },
  parked: {
    'user_resumed:proposal': 'proposed',
    'user_resumed:empty': 'new',
  },
  resolved: {
    'github_reopened:proposal': 'proposed',
    'github_reopened:empty': 'new',
  },
};

describe('nextStage', () => {
  for (const stage of STAGES) {
    for (const event of EVENTS) {
      const expected =
        event.kind === 'github_resolved' ? 'resolved' : (MOVES[stage][label(event)] ?? stage);
      it(`${stage} + ${label(event)} -> ${expected}`, () => {
        expect(nextStage({ stage, event })).toBe(expected);
      });
    }
  }

  it('never lets a publish start from a thread nobody approved', () => {
    expect(nextStage({ stage: 'proposed', event: { kind: 'publish_started' } })).toBe('proposed');
    expect(nextStage({ stage: 'new', event: { kind: 'publish_started' } })).toBe('new');
  });
});
