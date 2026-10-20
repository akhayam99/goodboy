import type { AgentRole } from '@goodboy/types';

export type RoleNeedDriver = 'auto' | 'orchestrator';

export type RoleNeed = {
  readonly role: AgentRole;
  readonly reason: string;
  readonly autoReason?: string;
  readonly doNot: string;
  readonly drivers: ReadonlyArray<RoleNeedDriver>;
};

export const ROLE_NEEDS: ReadonlyArray<RoleNeed> = [
  {
    role: 'scout',
    reason:
      'The goal names no files, or names more than one branch or area. The task would start with "find".',
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
    drivers: ['auto', 'orchestrator'],
  },
  {
    role: 'docs',
    reason: 'The goal asks for docs, a README or a changelog.',
    doNot: 'The goal asks for a report or a plan: those are artifacts of other roles.',
    drivers: ['auto', 'orchestrator'],
  },
  {
    role: 'tester',
    reason:
      'The goal or a result names a behavior with no test, or a fix that needs a regression test.',
    doNot: 'A result reports the covering tests green.',
    drivers: ['auto', 'orchestrator'],
  },
  {
    role: 'ci-fixer',
    reason: 'A red check on the branch is named.',
    doNot: 'Otherwise.',
    drivers: ['auto'],
  },
  {
    role: 'scribe',
    reason: 'A pull request text is asked for.',
    doNot: 'Otherwise.',
    drivers: ['auto'],
  },
  {
    role: 'rewriter',
    reason:
      'Never from Auto: it needs the History flow copy. Use an implementer with a force push publish.',
    doNot: 'Always.',
    drivers: ['auto'],
  },
];

const ROLE_NEED_DEFAULT = {
  auto: 'The default is one implementer with nothing added. Add a role only for a row below whose reason you can see in the goal or in a result.',
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
  const reason =
    driver === 'auto' && row.autoReason !== undefined
      ? `${row.reason} Or: ${row.autoReason}`
      : row.reason;
  return `- ${row.role}. Add it when: ${reason} Do not add it when: ${row.doNot}`;
};

export const roleNeedsSection = ({ driver }: RoleNeedDriverParams): string =>
  [
    'WHEN TO ADD A ROLE',
    ROLE_NEED_DEFAULT[driver],
    ROLE_NEED_PRECEDENCE[driver],
    ...roleNeedRows({ driver }).map((row) => roleNeedLine({ row, driver })),
  ].join('\n');
