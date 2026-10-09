// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { describe, expect, it } from 'vitest';
import { HANDOFF_SECTION_LABEL } from '../features/chat/utils/handoffLabels';
import { ROLE_LABEL } from '../features/session/agent-kind';
import { LENS_LABEL } from '../features/session/lens-labels';
import { SESSION_STAGE_META } from '../features/session/session-stage';
import { VERBOSITY_LABEL, verbosityDirective } from '../features/settings/verbosity';
import { RUN_AUTONOMY_HEADER } from '../features/workflows/runAutonomy';
import { FOLLOW_LABEL } from './lib/followToast';
import { fixLabel } from '../features/resolve/reviewLaunchCopy';
import { RETIRED_NAMES } from '../__tests__/regressions/retiredNames';
import { NAMES, formerNamesOf } from './names';

describe('names', () => {
  it('feeds the lens, role, handoff, stage, autonomy and reply length labels', () => {
    expect(RUN_AUTONOMY_HEADER).toBe(NAMES.whenToAsk);
    expect(ROLE_LABEL).toEqual(NAMES.role);
    expect(LENS_LABEL.questions).toBe(NAMES.questions);
    expect(LENS_LABEL.agents).toBe(NAMES.agents);
    expect(LENS_LABEL.workflows).toBe(NAMES.runs);
    expect(LENS_LABEL.review).toBe(NAMES.comments);
    expect(LENS_LABEL.plans).toBe(NAMES.artifacts);
    expect(LENS_LABEL.scripts).toBe(NAMES.scripts);
    expect(LENS_LABEL.terminal).toBe(NAMES.terminal);
    expect(LENS_LABEL.context).toBe(NAMES.context);
    expect(LENS_LABEL.goal).toBe(NAMES.goal);
    expect(LENS_LABEL.decisions).toBe(NAMES.decisions);
    expect(HANDOFF_SECTION_LABEL.goal).toBe(NAMES.goal);
    expect(HANDOFF_SECTION_LABEL.plan).toBe(NAMES.plan);
    expect(HANDOFF_SECTION_LABEL.files).toBe(NAMES.files);
    expect(SESSION_STAGE_META.attention.label).toBe(NAMES.needsYou.toLowerCase());
    expect(SESSION_STAGE_META.running.label).toBe(NAMES.running.toLowerCase());
    expect(SESSION_STAGE_META.review.label).toBe(NAMES.inReview.toLowerCase());
    expect(SESSION_STAGE_META.building.label).toBe(NAMES.building.toLowerCase());
    expect(SESSION_STAGE_META.done.label).toBe(NAMES.done.toLowerCase());
    expect(VERBOSITY_LABEL).toEqual({
      brief: NAMES.short,
      normal: NAMES.normal,
      verbose: NAMES.long,
    });
  });

  it('names the reply length Short, Normal and Long', () => {
    expect(Object.values(VERBOSITY_LABEL)).toEqual(['Short', 'Normal', 'Long']);
  });

  it('sends the provider the same reply length directive as before the rename', () => {
    expect(verbosityDirective('brief')).toBe(
      'Output verbosity: BRIEF. Output only what is strictly required to answer or act. No preambles, no recaps, no explanations unless asked. Single short sentence per update; one-line end-of-turn.',
    );
    expect(verbosityDirective('normal')).toBe(
      'Output verbosity: NORMAL. Standard prose. Include rationale when non-obvious; avoid filler.',
    );
    expect(verbosityDirective('verbose')).toBe(
      'Output verbosity: VERBOSE. Include reasoning, alternatives considered, and trade-offs. Long-form is acceptable.',
    );
  });

  it('retires a name only in favour of one that exists', () => {
    const known = new Set<string>(
      Object.values(NAMES).filter((value) => typeof value === 'string'),
    );

    expect(RETIRED_NAMES.filter((retired) => !known.has(retired.use))).toEqual([]);
  });

  it('registers the verbs of one job and the words of the door and the bell', () => {
    expect(NAMES).toMatchObject({
      start: 'Start',
      fix: 'Fix',
      approve: 'Approve',
      runPlan: 'Run plan',
      follow: 'Follow',
      pin: 'Pin session',
      unpin: 'Unpin session',
      notes: 'Notes',
      tasks: 'Tasks',
      notifications: 'Notifications',
      reply: 'Reply',
      resolve: 'Resolve',
      publishReply: 'Publish reply',
      retryPush: 'Retry push',
      newBranch: 'New branch',
      closeBranch: 'Close branch',
      switchBranch: 'Switch branch',
      rebaseOn: 'Rebase on',
    });
  });

  it('feeds the follow and fix labels from NAMES', () => {
    expect(FOLLOW_LABEL).toBe(NAMES.follow);
    expect(fixLabel({ count: 3 })).toBe(`${NAMES.fix} 3`);
  });

  it('lists the old words as former names of the new ones', () => {
    expect(formerNamesOf(NAMES.reply)).toContain('Reply yourself');
    expect(formerNamesOf(NAMES.resolve)).toContain('Resolve without a reply');
    expect(formerNamesOf(NAMES.publishReply)).toContain('Post reply now');
    expect(formerNamesOf(NAMES.newBranch)).toContain('New worktree');
    expect(formerNamesOf(NAMES.closeBranch)).toEqual(['Remove worktree', 'Close worktree']);
    expect(formerNamesOf(NAMES.rebaseOn)).toContain("Start from today's main");
    expect(formerNamesOf(NAMES.tasks)).toContain('Inbox');
  });

  it.each([
    ['Resolve 3 comments', 'resolve-n-comments'],
    ['Fix 9 open comments', 'fix-n-comments'],
    ['Draft fixes for 3', 'draft-a-fix'],
    ['Draft a fix', 'draft-a-fix'],
    ['Reply yourself', 'reply-yourself'],
    ['Resolve without a reply', 'resolve-without-reply'],
    ['Post reply now', 'post-reply-now'],
    ["Start from today's main", 'start-from-todays-main'],
    ['New worktree', 'new-worktree'],
    ['New worktree in ledger-core', 'new-worktree'],
    ['Remove worktree', 'remove-worktree'],
    ['Close worktree', 'close-worktree'],
    ['Waiting for your approval', 'waiting-for-approval'],
    ['notifications', 'lowercase-notifications'],
    ['Inbox', 'inbox-door'],
  ])('fails the old phrase %s', (phrase, id) => {
    const retired = RETIRED_NAMES.find((entry) => entry.id === id);

    expect(retired?.pattern.test(phrase)).toBe(true);
  });

  it.each(['Fix 3', 'Reply', 'Resolve', 'Publish reply', 'New branch', 'Close branch', 'Tasks'])(
    'lets the new word %s through',
    (phrase) => {
      expect(RETIRED_NAMES.filter((entry) => entry.pattern.test(phrase))).toEqual([]);
    },
  );

  it('spells no registered verb by hand outside NAMES', () => {
    const root = join(__dirname, '..');
    const hand =
      /(['"`])(Run plan|Pin session|Unpin session|Publish reply|Retry push|Close branch)\1/;
    const walk = (dir: string): ReadonlyArray<string> =>
      readdirSync(dir).flatMap((entry) => {
        const path = join(dir, entry);
        return statSync(path).isDirectory() ? walk(path) : [path];
      });
    const offenders = walk(root)
      .filter(
        (path) => /\.tsx?$/.test(path) && !/\.(test|rows)\.tsx?$|__tests__|MockScene/.test(path),
      )
      .filter((path) => !path.endsWith(join('shared', 'names.ts')))
      .filter((path) => hand.test(readFileSync(path, 'utf8')))
      .map((path) => relative(root, path));

    expect(offenders).toEqual([]);
  });
});
