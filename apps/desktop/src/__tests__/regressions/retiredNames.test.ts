// @vitest-environment node
import { readdirSync } from 'fs';
import { join } from 'path';
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

  it.each(['Online copy', 'Replace the online copy?'])('flags %s for On origin', (text) => {
    expect(retiredIdsIn({ text })).toContain('online-copy');
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

  it.each(['Start a run', 'Start workflow', 'Orchestrated', 'Let the Lead take it from here'])(
    'leaves the start verb %s alone',
    (text) => {
      expect(retiredIdsIn({ text })).toEqual([]);
    },
  );

  it.each([
    'Auto needs you',
    'Auto is reading the results',
    'Auto is rebasing on main',
    "Auto's answer to an agent was not sent",
    'Auto tried to start an Implementer',
    'Let Auto take it from here',
    'Detach from Auto',
    'Open Auto',
    'Message Auto',
    'Resolve with Auto',
    'Returned to Auto',
    'Stopped by Auto',
    'before Auto starts',
  ])('flags the old Lead wording %s', (text) => {
    expect(retiredIdsIn({ text })).toContain('auto-as-the-lead');
  });

  it.each([
    'Lead needs you',
    'Message Lead',
    'Auto',
    'Auto picks the model',
    'Auto in Models',
    'Auto on Claude',
    'Use as an Auto check',
    'Auto checks',
    'Auto · main',
  ])('keeps the current wording %s', (text) => {
    expect(retiredIdsIn({ text })).toEqual([]);
  });

  it.each([
    ['Auto agent', 'auto-agent'],
    ["Couldn't read the Auto agents", 'auto-agent'],
    ['Start work on this branch', 'start-work-verb'],
    ['Start work', 'start-work-verb'],
    ['Work', 'work-door'],
  ])('flags the word a run with its Lead replaced: %s', (text, id) => {
    expect(retiredIdsIn({ text })).toContain(id);
  });

  it.each(['Lead', 'Lead · plan Fix flaky tests', 'Start work from chat', 'Work on the export'])(
    'leaves the run word %s alone',
    (text) => {
      expect(retiredIdsIn({ text })).toEqual([]);
    },
  );

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

  it.each([
    ['Waiting for you', 'waiting-for-you-title'],
    ['Waits on you', 'waiting-for-you-title'],
    ['Waiting for your OK', 'waiting-for-you-title'],
    ['Waiting for your answer', 'waiting-for-you-title'],
    ['Folders', 'folders-noun'],
    ['Add folder', 'add-folder'],
  ])('flags %s as a title or a noun', (text, id) => {
    expect(retiredIdsIn({ text })).toContain(id);
  });

  it.each([
    'Needs you',
    'Projects',
    'Add project',
    'Add a plain folder',
    'Waiting for your first message',
    'Choose a folder',
    '2 projects, 1 plain folder',
  ])('leaves %s alone', (text) => {
    expect(retiredIdsIn({ text })).toEqual([]);
  });

  it('keeps the chat meaning of Start work from here retired outside the Work feature', () => {
    const retired = RETIRED_NAMES.find((entry) => entry.id === 'turn-into-work');
    expect(retired?.pattern.test('Start work from here')).toBe(true);
    expect(retired?.pattern.test('Start work')).toBe(false);
    expect(retired?.allowedPaths?.test('features/work/components/StartWork/index.tsx')).toBe(true);
    expect(retired?.allowedPaths?.test('features/workspace-chat/components/Panel.tsx')).toBe(false);
  });

  it('sends a bare Start work to Start a run, one owner for the old phrase', () => {
    expect(retiredIdsIn({ text: 'Start work' })).toEqual(['start-work-verb']);
  });

  it.each([
    ['Send message now', 'send-message'],
    ['Push commits to origin', 'push-commits'],
    ['View transcript of step 2', 'view-transcript'],
    ['Restore turn 4', 'restore-turn'],
    ['Mark all seen in Harborline', 'mark-all-seen'],
    ['Skip and go on to the next step', 'skip-and-go-on'],
    ['Remove link from this session', 'remove-link-from-session'],
    ['Add folder to Harborline', 'add-folder'],
  ])('flags the retired phrase inside a longer label: %s', (text, id) => {
    expect(retiredIdsIn({ text })).toContain(id);
  });

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
    expect(formerNamesOf(NAMES.runs)).toContain('Workflow runs');
  });

  it('never lists a label as its own former name', () => {
    expect(entries.filter(([label, former]) => label === former)).toEqual([]);
  });

  it('flags the old Inbox name that the Tasks door replaced', () => {
    expect(retiredIdsIn({ text: 'Inbox' })).toContain('inbox-door');
  });
});

describe('every file under retired/ feeds the guard', () => {
  const RETIRED_DIR = join(__dirname, 'retired');
  const unitModules = import.meta.glob<Readonly<Record<string, unknown>>>('./retired/*.ts', {
    eager: true,
  });

  it('loads one module per file in the folder', () => {
    const files = readdirSync(RETIRED_DIR)
      .filter((file) => file.endsWith('.ts'))
      .map((file) => `./retired/${file}`)
      .sort();

    expect(Object.keys(unitModules).sort()).toEqual(files);
    expect(files.length).toBeGreaterThan(0);
  });

  it('puts every name a unit retires in the list the guard reads', () => {
    const ids = new Set(RETIRED_NAMES.map((retired) => retired.id));
    const unitIds = Object.values(unitModules)
      .flatMap((module) => Object.values(module).flat())
      .flatMap((entry) =>
        typeof entry === 'object' && entry !== null && 'id' in entry ? [String(entry.id)] : [],
      );

    expect(unitIds.length).toBeGreaterThan(0);
    expect(unitIds.filter((id) => !ids.has(id))).toEqual([]);
  });

  it('gives each retired name one id across the shared list and the unit files', () => {
    const ids = RETIRED_NAMES.map((retired) => retired.id);

    expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
  });
});
