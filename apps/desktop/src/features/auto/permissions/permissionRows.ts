import type { LeadPermissionKey } from '@goodboy/core/auto';

export type PermissionOption = Readonly<{ value: string; label: string }>;

export type PermissionRowCopy = Readonly<{
  key: LeadPermissionKey;
  title: string;
  help: string;
  asksBefore: string;
  options: ReadonlyArray<PermissionOption>;
}>;

const ASK: PermissionOption = { value: 'ask', label: 'Ask' };
const ALLOW: PermissionOption = { value: 'allow', label: 'Allow' };

export const PERMISSION_ROWS: ReadonlyArray<PermissionRowCopy> = [
  {
    key: 'approvePlan',
    title: 'Approve the plan',
    help: 'Agents that write wait for an approved plan.',
    asksBefore: 'the plan',
    options: [ASK, { value: 'skip', label: 'Skip' }],
  },
  {
    key: 'startReaders',
    title: 'Start agents that read',
    help: 'Scout, Investigator, Reviewer.',
    asksBefore: 'agents that read',
    options: [ASK, { value: 'free', label: 'Free' }],
  },
  {
    key: 'startWriters',
    title: 'Start agents that write',
    help: 'Implementer, Tester, Docs, CI fixer.',
    asksBefore: 'agents that write',
    options: [
      ASK,
      { value: 'afterPlan', label: 'After the plan' },
      { value: 'free', label: 'Free' },
    ],
  },
  {
    key: 'push',
    title: 'Push a branch',
    help: 'Goodboy pushes, and only when checks pass.',
    asksBefore: 'a push',
    options: [ASK, { value: 'whenChecksPass', label: 'When checks pass' }],
  },
  {
    key: 'pullRequest',
    title: 'Open or update a pull request',
    help: 'A Scribe writes it. Goodboy publishes it.',
    asksBefore: 'a pull request',
    options: [ASK, ALLOW],
  },
  {
    key: 'dependencies',
    title: 'Add or upgrade dependencies',
    help: 'Asked before install: npm, pnpm, yarn, pip, cargo. Codex relies on the net.',
    asksBefore: 'a new dependency',
    options: [ASK, ALLOW],
  },
  {
    key: 'protectedFiles',
    title: 'Change protected files',
    help: 'CI config, git hooks, code owners. Codex relies on the net.',
    asksBefore: 'protected files',
    options: [ASK, ALLOW],
  },
  {
    key: 'addProject',
    title: 'Add a project',
    help: 'Within what the session allows.',
    asksBefore: 'adding a project',
    options: [ASK, { value: 'whenAllowed', label: 'When allowed' }, ALLOW],
  },
  {
    key: 'closeWork',
    title: 'Close the work',
    help: 'Who marks it finished.',
    asksBefore: '',
    options: [
      { value: 'you', label: 'You' },
      { value: 'lead', label: 'Lead' },
    ],
  },
];
