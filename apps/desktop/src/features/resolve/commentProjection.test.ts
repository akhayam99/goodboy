// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { RESOLVE_FAILURE_CAUSES, type ResolveFailureCause } from '@goodboy/types';
import {
  RESOLVE_GROUP_LABEL,
  RESOLVE_GROUP_OF_WORD,
  RESOLVE_LIST_GROUPS,
  RESOLVE_WORD_LABEL,
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
    stateReason: null,
    gitChip: null,
    hasFailedChecks: false,
    ...over,
  }) satisfies ResolveCommentFacts;

describe('projectResolveComment', () => {
  it.each<[ReviewCommentState, boolean, string, string, string]>([
    ['needs', false, 'question', 'Question', 'needs_you'],
    ['ready', false, 'to_review', 'Fix ready', 'needs_you'],
    ['edited', false, 'to_review', 'Fix ready', 'needs_you'],
    ['outdated', false, 'to_review', 'Fix ready', 'needs_you'],
    ['failed', true, 'push_failed', 'Push failed', 'needs_you'],
    ['failed', false, 'couldnt_fix', 'Failed', 'needs_you'],
    ['drafting', false, 'working', 'Fixing', 'working'],
    ['accepted', false, 'ready', 'Fixed', 'done'],
    ['replied', false, 'ready', 'Fixed', 'done'],
    ['pushed', false, 'replied', 'Replied', 'done'],
    ['resolved', false, 'done', 'Done', 'done'],
    ['skipped', false, 'left_open', 'Left open', 'left_open'],
    ['new', false, 'open', 'Open', 'needs_you'],
  ])(
    'puts %s (push failure %s) under %s, reads %s and groups it under %s',
    (state, isPushFailure, word, label, group) => {
      const projection = projectResolveComment(facts({ state, isPushFailure }));
      expect(projection.word).toBe(word);
      expect(RESOLVE_WORD_LABEL[projection.word]).toBe(label);
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
      'replied',
      'done',
    ]);
    expect(RESOLVE_LIST_GROUPS).toEqual(['needs_you', 'working', 'done', 'left_open']);
  });

  it('keeps Replied apart from Fixed: a delivered thread is not a fix still to push', () => {
    expect(RESOLVE_WORD_LABEL.replied).toBe('Replied');
    expect(RESOLVE_WORD_LABEL.ready).toBe('Fixed');
    expect(RESOLVE_GROUP_OF_WORD.replied).toBe('done');
    expect(RESOLVE_GROUP_OF_WORD.ready).toBe('done');
    expect(projectResolveComment(facts({ state: 'accepted' })).word).toBe('ready');
    expect(projectResolveComment(facts({ state: 'pushed' })).word).toBe('replied');
  });

  it('names the host in the group of the comments left open', () => {
    expect(leftOpenGroupLabel({ sourceLabel: 'GitHub' })).toBe('Left open on GitHub');
    expect(leftOpenGroupLabel({ sourceLabel: 'GitLab' })).toBe('Left open on GitLab');
    expect(leftOpenGroupLabel({ sourceLabel: 'Bitbucket' })).toBe('Left open on Bitbucket');
  });

  it('never calls a decided or sent comment by a sub-word', () => {
    const label = (state: ReviewCommentState) => projectResolveComment(facts({ state })).label;
    expect(label('pushed')).toBe('Replied');
    expect(label('resolved')).not.toBe(label('pushed'));
    expect(label('skipped')).toBe('Left open');
    expect(label('replied')).toBe('Fixed');
    expect(label('accepted')).toBe('Fixed');
    expect(projectResolveComment(facts({ state: 'resolved', sourceLabel: 'GitLab' })).label).toBe(
      'Resolved on GitLab',
    );
  });

  it('reads a pushed Bitbucket comment as Replied, never as resolved', () => {
    const pushed = projectResolveComment(facts({ state: 'pushed', sourceLabel: 'Bitbucket' }));
    expect(pushed.label).toBe('Replied');
    expect(pushed.label.toLowerCase()).not.toContain('resolved');
  });

  it('keeps a comment being published a Ready one that says Pushing', () => {
    expect(projectResolveComment(facts({ state: 'accepted', isPublishing: true }))).toMatchObject({
      word: 'ready',
      sub: 'pushing',
      label: 'Pushing',
    });
  });

  it('says Queued for a comment waiting for its turn in a fix, and Fixing otherwise', () => {
    expect(projectResolveComment(facts({ state: 'drafting' })).label).toBe('Fixing');
    expect(
      projectResolveComment(facts({ state: 'drafting', isWaitingForSlot: true })),
    ).toMatchObject({ word: 'working', sub: 'queued', label: 'Queued' });
    expect(projectResolveComment(facts({ state: 'drafting', isHeld: true }))).toMatchObject({
      word: 'working',
      sub: 'queued',
      label: 'Queued',
    });
    expect(projectResolveComment(facts({ state: 'new', isHeld: true })).sub).toBeNull();
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
      provider_error: 'The provider stopped the run',
      spend_cap: 'Every provider is over its limit',
      stopped: 'You stopped it',
      app_closed: 'The app closed while it was working',
      accept_conflict: 'It conflicts with a fix you accepted before',
      worktree_missing: 'The worktree for this comment is no longer available',
      capture_failed: "The fix couldn't be saved from its copy of the branch",
      no_result: 'The agent ended without a result for this comment',
      needs_a_run: 'The fix agent stopped: this is bigger than one change',
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

  it('says Needs a run from the thread, even when the batch attempt failed for another thread', () => {
    const needsRun = projectResolveComment(
      facts({
        state: 'failed',
        stateReason: 'needs_run:It touches the payouts route and two new components.',
        attempt: { phase: 'failed', failureCause: 'no_result' },
      }),
    );
    expect(needsRun).toMatchObject({
      word: 'couldnt_fix',
      sub: 'needs_run',
      label: 'Needs a run',
      sentence: 'The fix agent stopped: this is bigger than one change',
    });
    const silentSibling = projectResolveComment(
      facts({ state: 'failed', attempt: { phase: 'failed', failureCause: 'no_result' } }),
    );
    expect(silentSibling).toMatchObject({ sub: null, label: 'Failed' });
  });

  it('says the cause is not recorded for a failure written before causes existed', () => {
    expect(
      projectResolveComment(
        facts({ state: 'failed', attempt: { phase: 'failed', failureCause: null } }),
      ).sentence,
    ).toBe("Goodboy didn't record why");
    expect(projectResolveComment(facts({ state: 'failed' })).sentence).toBe(
      "Goodboy didn't record why",
    );
    expect(failureSentence({ cause: null })).toBe("Goodboy didn't record why");
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
    expect(projection).toMatchObject({
      word: 'to_review',
      label: 'Fix ready',
      isChanged: true,
    });
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

describe('a comment a run works on', () => {
  const working = { stateWord: 'Planning', end: 'working' as const };
  const finished = { stateWord: 'Done', end: 'finished' as const };
  const stopped = { stateWord: 'Stopped', end: 'stopped' as const };

  it.each<ReviewCommentState>(['new', 'failed', 'skipped'])(
    'reads In a run with the run word when the thread was %s',
    (state) => {
      const projection = projectResolveComment(facts({ state, run: working }));
      expect(projection).toMatchObject({ word: 'in_run', sub: null, label: 'In a run · Planning' });
      expect(RESOLVE_GROUP_OF_WORD[projection.word]).toBe('working');
    },
  );

  it('reads Run finished under Needs you once the run is done', () => {
    const projection = projectResolveComment(facts({ state: 'new', run: finished }));
    expect(projection).toMatchObject({ word: 'run_finished', label: 'Run finished' });
    expect(RESOLVE_GROUP_OF_WORD[projection.word]).toBe('needs_you');
  });

  it('keeps the word of a thread resolved or replied elsewhere while the run works', () => {
    expect(
      projectResolveComment(facts({ state: 'resolved', sourceLabel: 'GitHub', run: working })),
    ).toMatchObject({ word: 'done', label: 'Resolved on GitHub' });
    expect(projectResolveComment(facts({ state: 'pushed', run: working })).word).toBe('replied');
    expect(projectResolveComment(facts({ state: 'drafting', run: working })).word).toBe('working');
  });

  it('gives a stopped or failed run thread its own word back, so it reads Open', () => {
    expect(projectResolveComment(facts({ state: 'new', run: stopped }))).toMatchObject({
      word: 'open',
      label: 'Open',
    });
    expect(projectResolveComment(facts({ state: 'skipped', run: stopped })).word).toBe('left_open');
  });

  it('keeps a thread you kept open after the run as Left open, not Run finished', () => {
    expect(projectResolveComment(facts({ state: 'skipped', run: finished })).word).toBe(
      'left_open',
    );
  });

  it('asks nothing again of a thread resolved elsewhere once the run finished', () => {
    expect(
      projectResolveComment(facts({ state: 'resolved', sourceLabel: 'GitHub', run: finished })),
    ).toMatchObject({ word: 'done', label: 'Resolved on GitHub' });
  });

  it('reads In a run · Changed when the comment changed while the run works', () => {
    expect(
      projectResolveComment(facts({ state: 'new', run: working, isSourceChanged: true })).label,
    ).toBe('In a run · Changed');
  });

  it('drops the failure sentence once a run took the thread over', () => {
    expect(
      projectResolveComment(
        facts({ state: 'failed', attempt: { phase: 'failed', failureCause: null }, run: working }),
      ).sentence,
    ).toBeNull();
  });
});

describe('resolveLabelOfState', () => {
  it('names a state by its word', () => {
    expect(resolveLabelOfState({ state: 'edited' })).toBe('Fix ready');
    expect(resolveLabelOfState({ state: 'drafting' })).toBe('Fixing');
    expect(resolveLabelOfState({ state: 'failed' })).toBe('Failed');
    expect(resolveLabelOfState({ state: 'failed', isPushFailure: true })).toBe('Push failed');
  });
});
