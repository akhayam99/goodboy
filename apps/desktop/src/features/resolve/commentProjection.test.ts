// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { RESOLVE_FAILURE_CAUSES, type ResolveFailureCause } from '@goodboy/types';
import {
  RESOLVE_GROUP_LABEL,
  RESOLVE_GROUP_OF_WORD,
  RESOLVE_LIST_GROUPS,
  RESOLVE_WORD_LABEL,
  RESOLVE_WORD_TONE,
  leftOpenGroupLabel,
  projectResolveComment,
  resolveLabelOfState,
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
  it.each<[ReviewCommentState, boolean, string, string, string, string]>([
    ['needs', false, 'question', 'Question', 'warning', 'needs_you'],
    ['ready', false, 'to_review', 'To review', 'warning', 'needs_you'],
    ['edited', false, 'to_review', 'To review', 'warning', 'needs_you'],
    ['outdated', false, 'to_review', 'To review', 'warning', 'needs_you'],
    ['failed', true, 'push_failed', 'Push failed', 'danger', 'needs_you'],
    ['failed', false, 'couldnt_fix', "Couldn't fix", 'warning', 'needs_you'],
    ['drafting', false, 'working', 'Working', 'info', 'working'],
    ['accepted', false, 'ready', 'Ready', 'success', 'ready_to_push'],
    ['replied', false, 'ready', 'Ready', 'success', 'ready_to_push'],
    ['pushed', false, 'done', 'Done', 'neutral', 'done'],
    ['resolved', false, 'done', 'Done', 'neutral', 'done'],
    ['skipped', false, 'left_open', 'Left open', 'neutral', 'left_open'],
    ['new', false, 'open', 'Open', 'neutral', 'open'],
  ])(
    'puts %s (push failure %s) under %s, reads %s in %s and groups it under %s',
    (state, isPushFailure, word, label, tone, group) => {
      const projection = projectResolveComment(facts({ state, isPushFailure }));
      expect(projection.word).toBe(word);
      expect(RESOLVE_WORD_LABEL[projection.word]).toBe(label);
      expect(RESOLVE_WORD_TONE[projection.word]).toBe(tone);
      expect(RESOLVE_GROUP_OF_WORD[projection.word]).toBe(group);
    },
  );

  it('gives every state a word and keeps the groups in the delivery order', () => {
    expect(ALL_STATES.map((state) => projectResolveComment(facts({ state })).word)).toEqual([
      'open',
      'working',
      'question',
      'to_review',
      'to_review',
      'to_review',
      'couldnt_fix',
      'ready',
      'ready',
      'left_open',
      'done',
      'done',
    ]);
    expect(RESOLVE_LIST_GROUPS).toEqual([
      'needs_you',
      'working',
      'ready_to_push',
      'open',
      'done',
      'left_open',
    ]);
    expect(RESOLVE_GROUP_LABEL.ready_to_push).toBe('Ready to push');
  });

  it('names the host in the group of the comments left open', () => {
    expect(leftOpenGroupLabel({ sourceLabel: 'GitHub' })).toBe('Left open on GitHub');
    expect(leftOpenGroupLabel({ sourceLabel: 'GitLab' })).toBe('Left open on GitLab');
    expect(leftOpenGroupLabel({ sourceLabel: 'Bitbucket' })).toBe('Left open on Bitbucket');
  });

  it('never calls a decided or sent comment by a sub-word', () => {
    const label = (state: ReviewCommentState) => projectResolveComment(facts({ state })).label;
    expect(label('pushed')).toBe('Done');
    expect(label('skipped')).toBe('Left open');
    expect(label('replied')).toBe('Ready');
    expect(label('accepted')).toBe('Ready');
    expect(projectResolveComment(facts({ state: 'resolved', sourceLabel: 'GitLab' })).label).toBe(
      'Resolved on GitLab',
    );
  });

  it('reads a pushed Bitbucket comment as Done, never as resolved', () => {
    const pushed = projectResolveComment(facts({ state: 'pushed', sourceLabel: 'Bitbucket' }));
    expect(pushed.label).toBe('Done');
    expect(pushed.label.toLowerCase()).not.toContain('resolved');
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

  it("labels a push-side failure Push failed, never Couldn't fix, without a run cause sentence", () => {
    expect(projectResolveComment(facts({ state: 'failed', isPushFailure: true }))).toMatchObject({
      word: 'push_failed',
      sub: null,
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
    expect(projection).toMatchObject({ word: 'to_review', label: 'To review', isChanged: true });
    expect(projection.chips).toEqual(['Comment changed', 'Still needed', 'Checks failed']);
  });

  it('shows the git verdict of a question as a chip, never in place of Question', () => {
    const projection = projectResolveComment(
      facts({
        state: 'needs',
        gitChip: { word: 'Still needed', node: 'stopped', tone: 'warning' },
      }),
    );
    expect(projection).toMatchObject({ word: 'question', label: 'Question' });
    expect(projection.chips).toEqual(['Still needed']);
  });

  it('only flags failed checks on a change that waits for review or push', () => {
    expect(projectResolveComment(facts({ state: 'ready', hasFailedChecks: true })).chips).toEqual([
      'Checks failed',
    ]);
    expect(projectResolveComment(facts({ state: 'pushed', hasFailedChecks: true })).chips).toEqual(
      [],
    );
  });
});

describe('resolveLabelOfState', () => {
  it('names a state by its word', () => {
    expect(resolveLabelOfState({ state: 'edited' })).toBe('To review');
    expect(resolveLabelOfState({ state: 'drafting' })).toBe('Working');
    expect(resolveLabelOfState({ state: 'failed' })).toBe("Couldn't fix");
    expect(resolveLabelOfState({ state: 'failed', isPushFailure: true })).toBe('Push failed');
  });
});
