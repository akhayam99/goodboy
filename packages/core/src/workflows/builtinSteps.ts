import type { AgentRole, StepDefId } from '@goodboy/types';

export type BuiltinStep = {
  readonly id: StepDefId;
  readonly role: AgentRole;
  readonly name: string;
  readonly promptPrefix: string;
  readonly expectedOutput: string;
};

const builtinStepId = (slug: string): StepDefId => `seed_${slug}` as StepDefId;

export const BUILTIN_STEPS: ReadonlyArray<BuiltinStep> = [
  {
    id: builtinStepId('scout'),
    role: 'scout',
    name: 'Scout',
    promptPrefix:
      'Search the docs and the code for everything relevant to the goal. List the files in scope, the key abstractions, who calls them, and the tests that cover them. Back each entry with a file:line reference. Do not modify any code or propose changes yet.',
    expectedOutput:
      'A short map of the area: relevant files, key abstractions, callers, and existing tests, each with a file:line reference.',
  },
  {
    id: builtinStepId('investigator'),
    role: 'investigator',
    name: 'Investigate',
    promptPrefix:
      'Reproduce the problem first. Narrow it down until you find the root cause, and back it with the file and line where it starts. Do not fix it yet. Say what you ruled out and why.',
    expectedOutput:
      'How to reproduce the problem, the root cause with a file:line reference, and what was ruled out.',
  },
  {
    id: builtinStepId('planner'),
    role: 'planner',
    name: 'Plan',
    promptPrefix:
      'Turn what the previous steps found into a concrete, ordered plan. For each file, state exactly what changes and why. Order changes by risk, lowest first. Flag every test that needs updating. Do not write code.',
    expectedOutput: 'An ordered, per-file plan with risk notes and the list of impacted tests.',
  },
  {
    id: builtinStepId('implementer'),
    role: 'implementer',
    name: 'Implement',
    promptPrefix:
      'Apply the plan in small, reviewable steps. Update the affected tests in lock-step. Stay within scope. No speculative cleanup.',
    expectedOutput: 'A working tree with the plan applied and the affected tests updated.',
  },
  {
    id: builtinStepId('tester'),
    role: 'tester',
    name: 'Test',
    promptPrefix:
      'Run the tests that cover the change and add coverage for any path it exposed. Do not patch production code. Report production failures for an implementer to fix. Never weaken a test to make it pass.',
    expectedOutput:
      'Test results, the new coverage the change required, and production failures for an implementer.',
  },
  {
    id: builtinStepId('reviewer'),
    role: 'reviewer',
    name: 'Review',
    promptPrefix:
      'Read the diff and report correctness bugs, security issues and regressions, each with a file:line reference. Never edit code.',
    expectedOutput: 'A list of findings, most severe first, each with a file:line reference.',
  },
  {
    id: builtinStepId('resolver'),
    role: 'resolver',
    name: 'Resolve comments',
    promptPrefix:
      'Work through the open review comments one by one. Fix what the comment asks for, or explain why it should stay as it is. Keep each fix inside the scope of its comment.',
    expectedOutput: 'Each comment with the fix that answers it, or the reason it stays as it is.',
  },
  {
    id: builtinStepId('docs'),
    role: 'docs',
    name: 'Update docs',
    promptPrefix:
      'Find the docs that describe what changed and bring them in line with the code. Change only what the change made wrong or missing. Keep the voice of the doc you edit.',
    expectedOutput: 'The docs that changed, with one line per doc on what was wrong before.',
  },
];

const BUILTIN_STEP_IDS: ReadonlySet<string> = new Set(BUILTIN_STEPS.map((step) => step.id));

type StepIdParams = {
  readonly id: string;
};

export const isBuiltinStepId = ({ id }: StepIdParams): boolean => BUILTIN_STEP_IDS.has(id);

type RoleParams = {
  readonly role: AgentRole;
};

export const builtinStepForRole = ({ role }: RoleParams): BuiltinStep | undefined =>
  BUILTIN_STEPS.find((step) => step.role === role);
