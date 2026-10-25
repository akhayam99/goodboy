// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NAMES, formerNamesOf } from '../../shared/utils/names';
import { RETIRED_NAMES } from './retiredNames';

type Params = {
  readonly text: string;
};

const retiredIdsIn = ({ text }: Params): ReadonlyArray<string> =>
  RETIRED_NAMES.filter((retired) => retired.pattern.test(text)).map((retired) => retired.id);

describe('retired names match whatever the casing', () => {
  it.each(['Close inbox', 'Refresh inbox', 'refresh inbox', 'INBOX'])('flags %s', (text) => {
    expect(retiredIdsIn({ text })).toContain('inbox-door');
  });

  it('flags a lowercase worktree name', () => {
    expect(retiredIdsIn({ text: 'close worktree' })).toContain('close-worktree');
  });

  it.each(['Spend cap', 'Raise spend cap', 'over its spend cap'])('flags %s for Limit', (text) => {
    expect(retiredIdsIn({ text })).toContain('spend-cap');
  });

  it('leaves the spend_cap cause key alone', () => {
    expect(retiredIdsIn({ text: 'spend_cap' })).toEqual([]);
  });

  it.each([
    ['Ask an agent', 'ask-an-agent'],
    ['Start agent', 'start-agent'],
    ['Start Auto', 'start-auto'],
    ['Orchestrate', 'orchestrate-verb'],
    ['Start another run', 'start-a-run'],
    ['Start an agent', 'start-an-agent'],
    ['Start an auto', 'start-an-auto'],
    ['Run an orchestrator', 'run-an-orchestrator'],
    ['Run a workflow', 'start-workflow-run'],
    ['Move to Auto', 'move-to-auto'],
  ])('flags the old start label %s', (text, id) => {
    expect(retiredIdsIn({ text })).toContain(id);
  });

  it.each([
    'Start a run',
    'Start workflow',
    'Start Auto agent',
    'Orchestrated',
    'Let Auto take it from here',
  ])('leaves the start verb %s alone', (text) => {
    expect(retiredIdsIn({ text })).toEqual([]);
  });

  it.each([
    ['Pair device', 'pair-device'],
    ['Pair another device', 'pair-device'],
    ['Rewrite history', 'rewrite-history'],
    ['Sign out', 'sign-out-label'],
  ])('flags the secondary round word %s', (text, id) => {
    expect(retiredIdsIn({ text })).toContain(id);
  });

  it.each(['Sign out of Claude', 'Pair an iPhone', 'Edit commits', 'Disconnect'])(
    'leaves %s alone',
    (text) => {
      expect(retiredIdsIn({ text })).toEqual([]);
    },
  );

  it('leaves a data attribute alone', () => {
    expect(retiredIdsIn({ text: '[data-inbox-key="a"]' })).toEqual([]);
  });
});

type NamesNode = string | { readonly [key: string]: NamesNode };

const currentLabelsIn = ({ node }: { readonly node: NamesNode }): ReadonlyArray<string> =>
  typeof node === 'string'
    ? [node]
    : Object.values(node).flatMap((child) => currentLabelsIn({ node: child }));

describe('the unit of work is a session and Tasks is the work of other tools', () => {
  it.each([
    ['Each task is a session', 'session-is-a-task'],
    ['Each task gets its own branch', 'session-is-a-task'],
    ['A session is one task', 'session-is-a-task'],
    ['One task with one goal', 'session-is-a-task'],
    ['Give it a first task', 'session-is-a-task'],
    ['Write the task first.', 'write-the-task'],
    ['Describe a task, or pick one from Tasks', 'describe-a-task'],
    ['Tasks of ledger-core', 'scripts-tasks-band'],
    ['Start on a task', 'start-on-a-task'],
  ])('flags %s', (text, id) => {
    expect(retiredIdsIn({ text })).toContain(id);
  });

  it.each([
    'Tasks',
    'Open Tasks',
    'Pick from Tasks',
    'Commands of ledger-core',
    'Start session',
    'Write the goal first.',
    'The task id is added when the session starts from a task.',
  ])('leaves %s alone', (text) => {
    expect(retiredIdsIn({ text })).toEqual([]);
  });
});

describe('FORMER_NAMES is read by the guard', () => {
  const entries = currentLabelsIn({ node: NAMES }).flatMap((label) =>
    formerNamesOf(label).map((former) => [label, former] as const),
  );

  it('reads a former name for the labels that were renamed', () => {
    expect(entries.length).toBeGreaterThan(50);
    expect(formerNamesOf(NAMES.tasks)).toContain('Inbox');
    expect(formerNamesOf(NAMES.runs)).toContain('Workflows');
  });

  it('never lists a label as its own former name', () => {
    expect(entries.filter(([label, former]) => label === former)).toEqual([]);
  });

  it('flags the old Inbox name that the Tasks door replaced', () => {
    expect(retiredIdsIn({ text: 'Inbox' })).toContain('inbox-door');
  });
});
