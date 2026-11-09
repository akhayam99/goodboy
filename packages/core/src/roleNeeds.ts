import type { AgentRole } from '@goodboy/types';

export type RoleNeedDriver = 'auto' | 'orchestrator';

export type RoleNeed = {
  readonly role: AgentRole;
  readonly reason: string;
  readonly autoReason?: string;
  readonly doNot: string;
  readonly autoDoNot?: string;
  readonly drivers: ReadonlyArray<RoleNeedDriver>;
};

export const ROLE_NEEDS: ReadonlyArray<RoleNeed> = [
  {
    role: 'scout',
    reason:
      'The goal names no files, or names more than one branch or area. The task would start with "find".',
    autoReason:
      'The task reads the commits, pull request, review threads or checks of a branch: name the mounts in "facts".',
    doNot: 'The goal names the file. Your own reads answer it.',
    drivers: ['auto', 'orchestrator'],
  },
  {
    role: 'planner',
    reason: 'Two or more writers would get the same task on different branches or areas.',
    doNot: 'The writers have different files and different goals.',
    drivers: ['auto', 'orchestrator'],
  },
  {
    role: 'reviewer',
    reason:
      'The goal says push, force push, open a PR or regroup history, or a result reports a change to a shared file.',
    autoReason: 'No Auto checks are ticked for the project.',
    doNot:
      'Checks are green and the change is docs or tests only, or it would be a second review of the same work.',
    drivers: ['auto', 'orchestrator'],
  },
  {
    role: 'investigator',
    reason: 'A result names a red check or an error whose cause it does not state.',
    doNot: 'The error text states the cause. Then an implementer fixes it.',
    autoDoNot: 'The failure is a red check of the branch: a CI fixer finds its cause and fixes it.',
    drivers: ['auto', 'orchestrator'],
  },
  {
    role: 'rewriter',
    reason:
      'History words: regroup, squash, reword, reorder, split or tidy commits. Auto cannot start one yet (it needs the History flow copy): that work goes to an implementer with "publish":{"mode":"force"}.',
    doNot: 'Always, until Auto can start a rewriter.',
    drivers: ['auto'],
  },
  {
    role: 'ci-fixer',
    reason: 'A red or failing check is named anywhere: in the goal or in a result.',
    doNot: 'The check is green again, or it is not a check of this branch.',
    drivers: ['auto'],
  },
  {
    role: 'scribe',
    reason: 'A pull request title, body or opening is asked for, in the goal or in a result.',
    doNot: 'Nobody asked for the pull request. An implementer never writes or opens one.',
    drivers: ['auto'],
  },
  {
    role: 'tester',
    reason:
      'The goal or a result names a behavior with no test, or a fix that needs a regression test.',
    doNot: 'A result reports the covering tests green.',
    drivers: ['auto', 'orchestrator'],
  },
  {
    role: 'docs',
    reason: 'The goal asks for docs, a README or a changelog.',
    doNot: 'The goal asks for a report or a plan: those are artifacts of other roles.',
    drivers: ['auto', 'orchestrator'],
  },
  {
    role: 'implementer',
    reason:
      'The task changes source code and no row above fits. Also a check that must run commands and changes nothing, while no reading role has git: write "read only, change nothing" in the task.',
    doNot: 'A row above fits: its role is narrower.',
    drivers: ['auto'],
  },
];

const ROLE_NEED_DEFAULT = {
  auto: 'Pick the narrowest row whose trigger you see in the goal or in a result. An implementer only changes code and is the fallback when no other row fits. Goodboy refuses an implementer once when its title or task fits a narrower role; to keep it, add "roleReason" to the child with one line on why.',
  orchestrator:
    'The default is the fewest steps that finish the goal. Add a role only for a row below whose reason you can see in the goal or in a finished step.',
} as const satisfies Readonly<Record<RoleNeedDriver, string>>;

const ROLE_NEED_PRECEDENCE = {
  auto: 'When a row reason and its do-not both hold, the do-not wins, except for a force push, where a reviewer always joins.',
  orchestrator: 'When a row reason and its do-not both hold, the do-not wins.',
} as const satisfies Readonly<Record<RoleNeedDriver, string>>;

type RoleNeedDriverParams = {
  readonly driver: RoleNeedDriver;
};

export const roleNeedRows = ({ driver }: RoleNeedDriverParams): ReadonlyArray<RoleNeed> =>
  ROLE_NEEDS.filter((row) => row.drivers.includes(driver));

type RoleNeedLineParams = {
  readonly row: RoleNeed;
  readonly driver: RoleNeedDriver;
};

const roleNeedLine = ({ row, driver }: RoleNeedLineParams): string => {
  const isAuto = driver === 'auto';
  const reason =
    isAuto && row.autoReason !== undefined ? `${row.reason} Or: ${row.autoReason}` : row.reason;
  const doNot =
    isAuto && row.autoDoNot !== undefined ? `${row.doNot} Or: ${row.autoDoNot}` : row.doNot;
  return `- ${row.role}. Add it when: ${reason} Do not add it when: ${doNot}`;
};

export const roleNeedsSection = ({ driver }: RoleNeedDriverParams): string =>
  [
    'WHEN TO ADD A ROLE',
    ROLE_NEED_DEFAULT[driver],
    ROLE_NEED_PRECEDENCE[driver],
    ...roleNeedRows({ driver }).map((row) => roleNeedLine({ row, driver })),
  ].join('\n');
