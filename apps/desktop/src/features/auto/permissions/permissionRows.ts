import { OFFLINE_PACKAGE_MANAGERS, type LeadPermissionKey } from '@goodboy/core/auto';
import { NAMES } from '../../../shared/utils/names';

export type PermissionOption = Readonly<{ value: string; label: string }>;

export type PermissionRowCopy = Readonly<{
  key: LeadPermissionKey;
  title: string;
  help: string;
  options: ReadonlyArray<PermissionOption>;
}>;

const ASK_FIRST = 'Ask first';
const GO_AHEAD = 'Go ahead';

const ASK: PermissionOption = { value: 'ask', label: ASK_FIRST };
const ALLOW: PermissionOption = { value: 'allow', label: GO_AHEAD };
const FREE: PermissionOption = { value: 'free', label: GO_AHEAD };

export const PERMISSION_ROWS: ReadonlyArray<PermissionRowCopy> = [
  {
    key: 'approvePlan',
    title: 'Approve the plan',
    help: 'Agents that write wait for an approved plan.',
    options: [ASK, { value: 'skip', label: 'Skip' }],
  },
  {
    key: 'startReaders',
    title: 'Start agents that read',
    help: 'Scout, Investigator, Reviewer.',
    options: [ASK, FREE],
  },
  {
    key: 'startWriters',
    title: 'Start agents that write',
    help: 'Implementer, Tester, Docs, CI fixer.',
    options: [ASK, { value: 'afterPlan', label: NAMES.afterThePlan }, FREE],
  },
  {
    key: 'push',
    title: 'Push a branch',
    help: 'Goodboy pushes, and only when checks pass.',
    options: [ASK, { value: 'whenChecksPass', label: 'When checks pass' }],
  },
  {
    key: 'pullRequest',
    title: 'Open or update a pull request',
    help: 'A Scribe writes it. Goodboy publishes it.',
    options: [ASK, ALLOW],
  },
  {
    key: 'dependencies',
    title: 'Add or upgrade dependencies',
    help: `Asked before install. Offline: ${OFFLINE_PACKAGE_MANAGERS.join(', ')}. Others rely on the net.`,
    options: [ASK, ALLOW],
  },
  {
    key: 'protectedFiles',
    title: 'Change protected files',
    help: 'CI config, git hooks, code owners. Codex relies on the net.',
    options: [ASK, ALLOW],
  },
  {
    key: 'addProject',
    title: 'Add a project',
    help: 'Within what the session allows.',
    options: [ASK, { value: 'whenAllowed', label: 'When allowed' }, ALLOW],
  },
  {
    key: 'closeWork',
    title: 'Close the work',
    help: 'Who marks it finished.',
    options: [
      { value: 'you', label: 'You' },
      { value: 'lead', label: `The ${NAMES.lead}` },
    ],
  },
];
