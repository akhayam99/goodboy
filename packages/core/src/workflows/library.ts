import type { AgentRole } from '@goodboy/types';
import { BUILTIN_STEPS } from './builtinSteps';

export type WorkflowLibraryStep = {
  readonly name: string;
  readonly role: string;
  readonly promptPrefix: string;
  readonly expectedOutput: string;
};

export type WorkflowLibraryEntry = {
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly goal?: string;
  readonly steps: ReadonlyArray<WorkflowLibraryStep>;
};

const builtinStep = (role: AgentRole): WorkflowLibraryStep => {
  const step = BUILTIN_STEPS.find((candidate) => candidate.role === role);
  if (step === undefined) {
    throw new Error(`no built-in step for role ${role}`);
  }
  return {
    name: step.name,
    role: step.role,
    promptPrefix: step.promptPrefix,
    expectedOutput: step.expectedOutput,
  };
};

export const WORKFLOW_LIBRARY: ReadonlyArray<WorkflowLibraryEntry> = [
  {
    slug: 'refactor-example',
    name: 'Refactor',
    description: 'Scout the area, plan the change, implement it, then test.',
    goal: 'Restructure the target code without changing its behavior, keeping tests green throughout.',
    steps: [
      {
        name: 'Scout',
        role: 'scout',
        promptPrefix:
          'Search the docs and the code for everything relevant to the goal. List the files in scope, the key abstractions, who calls them, and the tests that cover them. Back each entry with a file:line reference. Do not modify any code or propose changes yet.',
        expectedOutput:
          'A short map of the area: relevant files, key abstractions, callers, and existing tests, each with a file:line reference.',
      },
      {
        name: 'Plan',
        role: 'planner',
        promptPrefix:
          'Turn the scout map into a concrete, ordered refactor plan. For each file, state exactly what stays, what moves, and what gets deleted. Order changes by risk, lowest first. Flag every test that needs updating. Do not write code.',
        expectedOutput:
          'An ordered, per-file refactor plan with risk notes and the list of impacted tests.',
      },
      {
        name: 'Implement',
        role: 'implementer',
        promptPrefix:
          'Apply the refactor in small, reviewable steps that follow the plan. Keep behavior unchanged unless the plan says otherwise. Update the affected tests in lock-step. Stay within scope. No speculative cleanup.',
        expectedOutput:
          'A working tree with the refactor applied and the affected tests updated in lock-step.',
      },
      {
        name: 'Test',
        role: 'tester',
        promptPrefix:
          'Run the full test suite and confirm the refactor preserved behavior. Add coverage for any path the refactor exposed. Do not patch production code. Report production failures for an implementer to fix. Never weaken a test to make it pass.',
        expectedOutput:
          'Test results, any new coverage the refactor required, and production failures for an implementer.',
      },
    ],
  },
  {
    slug: 'plan-and-ship',
    name: 'Plan and ship',
    description: 'Scout the codebase, plan the change, implement it, then review the diff.',
    goal: 'Ship the change the task describes, with a reviewed diff.',
    steps: [
      builtinStep('scout'),
      builtinStep('planner'),
      builtinStep('implementer'),
      builtinStep('reviewer'),
    ],
  },
  {
    slug: 'fix-a-bug',
    name: 'Fix a bug',
    description: 'Investigate a bug, fix the root cause, and add regression tests.',
    goal: 'Fix the root cause of the bug and cover it with a regression test.',
    steps: [builtinStep('investigator'), builtinStep('implementer'), builtinStep('tester')],
  },
];
