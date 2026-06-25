export type WorkflowLibraryStep = {
  readonly name: string
  readonly role: string
  readonly promptPrefix: string
  readonly expectedOutput: string
}

export type WorkflowLibraryEntry = {
  readonly slug: string
  readonly name: string
  readonly description: string
  readonly goal?: string
  readonly steps: ReadonlyArray<WorkflowLibraryStep>
}

export const WORKFLOW_LIBRARY: ReadonlyArray<WorkflowLibraryEntry> = [
  {
    slug: 'refactor',
    name: 'Refactor',
    description: 'Scout the area, plan the change, refactor, then verify.',
    goal: 'Restructure the target code without changing its behavior, keeping tests green throughout.',
    steps: [
      {
        name: 'Scout',
        role: 'scout',
        promptPrefix:
          'Survey the area of code in scope. List relevant files, key abstractions, callers, and any tests. Do not propose changes yet.',
        expectedOutput: 'A short map of the area: files, abstractions, callers, tests.',
      },
      {
        name: 'Plan',
        role: 'planner',
        promptPrefix:
          'Propose a refactor plan. Order changes by risk. Identify what stays, what moves, and what gets deleted. Flag any tests that need updating.',
        expectedOutput: 'An ordered plan with risk notes and impacted tests.',
      },
      {
        name: 'Refactor',
        role: 'implementer',
        promptPrefix:
          'Apply the refactor in small commits. Keep behavior unchanged unless the plan says otherwise. Update tests in lock-step.',
        expectedOutput: 'Working tree with the refactor applied; tests still green.',
      },
      {
        name: 'Verify',
        role: 'reviewer',
        promptPrefix:
          'Run the test suite and review the diff against the plan. Note anything that drifted, anything skipped, and any new tech-debt introduced.',
        expectedOutput: 'A pass/fail report with diff vs plan + open follow-ups.',
      },
    ],
  },
  {
    slug: 'bug-fix',
    name: 'Bug fix',
    description: 'Reproduce with a failing test, diagnose, fix, verify.',
    goal: 'Resolve the reported bug at its root cause and guard it with a regression test.',
    steps: [
      {
        name: 'Reproduce',
        role: 'tester',
        promptPrefix:
          'Reproduce the bug and lock it in with a minimal FAILING test. Capture the failing input, expected output, and actual output. Do not fix anything yet.',
        expectedOutput: 'A committed failing test that captures the bug.',
      },
      {
        name: 'Diagnose',
        role: 'investigator',
        promptPrefix:
          'Trace the failure to its root cause. Identify the smallest set of files involved. Avoid speculation; back every claim with a file:line reference.',
        expectedOutput: 'A root-cause statement with file:line references.',
      },
      {
        name: 'Fix',
        role: 'implementer',
        promptPrefix:
          'Apply the smallest change that resolves the root cause. Do not bundle unrelated cleanup. Make the failing test pass.',
        expectedOutput: 'A focused diff that turns the failing test green.',
      },
      {
        name: 'Verify',
        role: 'reviewer',
        promptPrefix:
          'Run the full test suite. Confirm no regressions. Re-read the diff to ensure scope did not creep.',
        expectedOutput: 'All tests green + a one-paragraph summary of the fix.',
      },
    ],
  },
  {
    slug: 'ship',
    name: 'Ship it',
    description: 'Plan, implement, test, review. End to end.',
    goal: 'Take the change from plan to reviewed, tested, shippable code in one pass.',
    steps: [
      {
        name: 'Plan',
        role: 'planner',
        promptPrefix:
          'Turn the goal into a concrete, ordered plan: files to touch and the specific change per file. No code yet.',
        expectedOutput: 'An ordered plan with file paths and per-file changes.',
      },
      {
        name: 'Implement',
        role: 'implementer',
        promptPrefix:
          'Execute the plan with minimal, correct changes. Stay in scope. Keep the diff reviewable.',
        expectedOutput: 'Working code that follows the plan.',
      },
      {
        name: 'Test',
        role: 'tester',
        promptPrefix:
          'Cover the change with tests: happy path, edge cases, and a regression guard. Fix the code, never weaken a test.',
        expectedOutput: 'A green test suite that exercises the change.',
      },
      {
        name: 'Review',
        role: 'reviewer',
        promptPrefix:
          'Review the full diff for correctness, security and scope creep. Report findings; do not rewrite unrelated code.',
        expectedOutput: 'A pass/fail review with any follow-ups.',
      },
    ],
  },
  {
    slug: 'feature',
    name: 'Feature',
    description: 'Survey, plan, implement, test.',
    goal: 'Deliver the new feature end to end, meeting its acceptance criteria with test coverage.',
    steps: [
      {
        name: 'Survey',
        role: 'scout',
        promptPrefix:
          'Survey where this feature fits: the modules it touches, existing patterns to follow, and any constraints. Do not write code.',
        expectedOutput: 'A short map of where the feature lands and what to reuse.',
      },
      {
        name: 'Plan',
        role: 'planner',
        promptPrefix:
          'Turn the goal into a concrete plan: user-facing behavior, acceptance criteria, modules to touch, new types and data flow. No code yet.',
        expectedOutput: 'A plan with acceptance criteria and per-file changes.',
      },
      {
        name: 'Implement',
        role: 'implementer',
        promptPrefix:
          'Build the feature against the plan. Stop at the first acceptance criterion that needs clarification. Keep diffs reviewable.',
        expectedOutput: 'Working code that satisfies the acceptance criteria.',
      },
      {
        name: 'Test',
        role: 'tester',
        promptPrefix:
          'Cover the happy path, edge cases, and at least one regression case for prior bugs in the area. Prefer integration tests where they pay back.',
        expectedOutput: 'A test suite that exercises the feature and guards regressions.',
      },
    ],
  },
  {
    slug: 'exploration',
    name: 'Exploration',
    description: 'Single open-ended agent.',
    steps: [
      {
        name: 'Explore',
        role: 'custom',
        promptPrefix: '',
        expectedOutput: '',
      },
    ],
  },
]
