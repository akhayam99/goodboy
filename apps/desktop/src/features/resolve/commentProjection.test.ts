// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { RESOLVE_FAILURE_CAUSES, type ResolveFailureCause } from '@goodboy/types';
import {
  RESOLVE_WORD_LABEL,
  projectResolveComment,
  resolveLabelOfState,
  resolveTallyOf,
  resolveTallyParts,
  type ResolveCommentFacts,
} from './commentProjection';
import { failureSentence } from './failureSentence';
import type { ReviewCommentState } from './reviewCommentState';

const ALL_STATES: ReadonlyArray<ReviewCommentState> = [
  'new',
  'drafting',
  'needs',
  'ready',
  'edited',
  'outdated',
  'failed',
  'accepted',
  'replied',
  'skipped',
  'pushed',
  'resolved',
];

const facts = (over: Partial<ResolveCommentFacts> & Pick<ResolveCommentFacts, 'state'>) =>
  ({
    isPublishing: false,
    isWaitingForSlot: false,
    isPushFailure: false,
    sourceLabel: 'GitHub',
    attempt: null,
    gitChip: null,
    hasFailedChecks: false,
    ...over,
  }) satisfies ResolveCommentFacts;

describe('projectResolveComment', () => {
  it('puts every state of a comment under one of the five words, and an open one under Open', () => {
    expect(ALL_STATES.map((state) => projectResolveComment(facts({ state })).word)).toEqual([
      'open',
      'working',
      'needs_you',
      'ready',
      'ready',
      'ready',
      'couldnt_fix',
      'ready',
      'done',
      'done',
      'done',
      'done',
    ]);
    expect(Object.values(RESOLVE_WORD_LABEL)).toEqual([
      'Open',
      'Working',
      'Needs you',
      'Ready',
      "Couldn't fix",
      'Done',
    ]);
  });

  it('carries the quiet sub-word of a Done comment as the label', () => {
    const label = (state: ReviewCommentState) => projectResolveComment(facts({ state })).label;
    expect(label('pushed')).toBe('Pushed');
    expect(label('skipped')).toBe('Skipped');
    expect(label('replied')).toBe('Answered');
    expect(label('accepted')).toBe('Accepted');
    expect(projectResolveComment(facts({ state: 'accepted' }))).toMatchObject({
      word: 'ready',
      sub: 'accepted',
    });
    expect(projectResolveComment(facts({ state: 'resolved', sourceLabel: 'GitLab' })).label).toBe(
      'Resolved on GitLab',
    );
    expect(projectResolveComment(facts({ state: 'pushed' }))).toMatchObject({
      word: 'done',
      sub: 'pushed',
    });
  });

  it('keeps a comment being published a Ready one that says Pushing', () => {
    expect(projectResolveComment(facts({ state: 'accepted', isPublishing: true }))).toMatchObject({
      word: 'ready',
      sub: 'pushing',
      label: 'Pushing',
    });
  });

  it('says Waiting for a comment queued behind another launch, and Working otherwise', () => {
    expect(projectResolveComment(facts({ state: 'drafting' })).label).toBe('Working');
    expect(
      projectResolveComment(facts({ state: 'drafting', isWaitingForSlot: true })),
    ).toMatchObject({ word: 'working', sub: 'waiting', label: 'Waiting' });
  });

  it('shows a stop by the user as Stopped, a comment that could not be fixed, with its sentence', () => {
    const stopped = projectResolveComment(
      facts({ state: 'failed', attempt: { phase: 'cancelled', failureCause: 'stopped' } }),
    );
    expect(stopped).toMatchObject({
      word: 'couldnt_fix',
      sub: 'stopped',
      label: 'Stopped',
      sentence: 'You stopped it',
    });
    const legacyStop = projectResolveComment(
      facts({ state: 'failed', attempt: { phase: 'cancelled', failureCause: null } }),
    );
    expect(legacyStop).toMatchObject({ sub: 'stopped', sentence: 'You stopped it' });
  });

  it("gives every recorded cause its own sentence under Couldn't fix", () => {
    const expected: Record<ResolveFailureCause, string> = {
      start_failed: "The fix didn't start",
      provider_error: 'The model provider stopped the run',
      spend_cap: 'Every provider is over its spend cap',
      stopped: 'You stopped it',
      app_closed: 'The app closed while it was working',
      accept_conflict: 'It conflicts with a fix you accepted before',
      worktree_missing: 'The worktree for this comment is no longer available',
      capture_failed: "The fix couldn't be saved from its copy of the branch",
    };
    const sentences = RESOLVE_FAILURE_CAUSES.map((cause) => {
      const projection = projectResolveComment(
        facts({ state: 'failed', attempt: { phase: 'failed', failureCause: cause } }),
      );
      expect(projection.word).toBe('couldnt_fix');
      return projection.sentence;
    });
    expect(sentences).toEqual(RESOLVE_FAILURE_CAUSES.map((cause) => expected[cause]));
    expect(new Set(sentences).size).toBe(RESOLVE_FAILURE_CAUSES.length);
  });

  it('says the cause is not recorded for a failure written before causes existed', () => {
    expect(
      projectResolveComment(
        facts({ state: 'failed', attempt: { phase: 'failed', failureCause: null } }),
      ).sentence,
    ).toBe('Cause not recorded');
    expect(projectResolveComment(facts({ state: 'failed' })).sentence).toBe('Cause not recorded');
    expect(failureSentence({ cause: null })).toBe('Cause not recorded');
  });

  it('labels a push-side failure Push failed without a run cause sentence', () => {
    expect(projectResolveComment(facts({ state: 'failed', isPushFailure: true }))).toMatchObject({
      word: 'couldnt_fix',
      sub: 'push_failed',
      label: 'Push failed',
      sentence: null,
    });
  });

  it('keeps the git verdict, a changed comment and failed checks as chips next to the real word', () => {
    const projection = projectResolveComment(
      facts({
        state: 'outdated',
        gitChip: { word: 'Still needed', node: 'stopped', tone: 'warning' },
        hasFailedChecks: true,
      }),
    );
    expect(projection).toMatchObject({ word: 'ready', label: 'Ready', isChanged: true });
    expect(projection.chips).toEqual(['Comment changed', 'Still needed', 'Checks failed']);
  });

  it('shows the git verdict of a question as a chip, never in place of Needs you', () => {
    const projection = projectResolveComment(
      facts({
        state: 'needs',
        gitChip: { word: 'Still needed', node: 'stopped', tone: 'warning' },
      }),
    );
    expect(projection).toMatchObject({ word: 'needs_you', label: 'Needs you' });
    expect(projection.chips).toEqual(['Still needed']);
  });

  it('only flags failed checks on a Ready change', () => {
    expect(projectResolveComment(facts({ state: 'ready', hasFailedChecks: true })).chips).toEqual([
      'Checks failed',
    ]);
    expect(projectResolveComment(facts({ state: 'pushed', hasFailedChecks: true })).chips).toEqual(
      [],
    );
  });
});

describe('resolveTallyOf', () => {
  it('counts comments by word, not agents', () => {
    const states: ReadonlyArray<ReviewCommentState> = [
      'ready',
      'ready',
      'edited',
      'outdated',
      'needs',
      'drafting',
      'drafting',
      'failed',
      'pushed',
      'new',
    ];
    const tally = resolveTallyOf({ states });
    expect(tally).toEqual({
      open: 1,
      working: 2,
      needs_you: 1,
      ready: 4,
      couldnt_fix: 1,
      done: 1,
    });
    expect(resolveTallyParts({ tally })).toEqual([
      '4 ready',
      '1 needs you',
      '2 working',
      "1 couldn't fix",
    ]);
  });

  it('keeps accepted comments in Ready until they are pushed', () => {
    const tally = resolveTallyOf({ states: ['accepted', 'accepted', 'ready', 'pushed'] });
    expect(tally).toMatchObject({ ready: 3, done: 1 });
  });

  it('names a state by its word', () => {
    expect(resolveLabelOfState({ state: 'edited' })).toBe('Ready');
    expect(resolveLabelOfState({ state: 'drafting' })).toBe('Working');
    expect(resolveLabelOfState({ state: 'failed' })).toBe("Couldn't fix");
  });
});
