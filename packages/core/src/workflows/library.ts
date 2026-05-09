export interface WorkflowLibraryStep {
  readonly name: string;
  readonly role: string;
  readonly promptPrefix: string;
  readonly expectedOutput: string;
}

export interface WorkflowLibraryEntry {
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly steps: ReadonlyArray<WorkflowLibraryStep>;
}

export const WORKFLOW_LIBRARY: ReadonlyArray<WorkflowLibraryEntry> = [
  {
    slug: 'refactor',
    name: 'Refactor',
    description: 'Scout the area, plan the change, refactor, then verify.',
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
    description: 'Reproduce, diagnose, fix, verify.',
    steps: [
      {
        name: 'Reproduce',
        role: 'investigator',
        promptPrefix:
          'Find a minimal reproduction. Capture the failing input, expected output, and actual output. Add a failing test if feasible.',
        expectedOutput: 'A reliable repro + a failing test (or a precise unwritten test plan).',
      },
      {
        name: 'Diagnose',
        role: 'investigator',
        promptPrefix:
          'Trace the failure to its root cause. Identify the smallest set of files involved. Avoid speculation; back claims with code references.',
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
    slug: 'feature',
    name: 'Feature',
    description: 'Spec the change, design it, implement it, test it.',
    steps: [
      {
        name: 'Spec',
        role: 'product',
        promptPrefix:
          'Clarify the user-facing behavior in 5-10 bullets. List acceptance criteria. Flag open questions before any code is written.',
        expectedOutput: 'A short spec with ACs and open questions.',
      },
      {
        name: 'Design',
        role: 'architect',
        promptPrefix:
          'Propose the technical approach. Identify the modules touched, new types, data flow, and any migrations. Keep alternatives short.',
        expectedOutput: 'A design note with modules, types, data flow, and migration notes.',
      },
      {
        name: 'Implement',
        role: 'implementer',
        promptPrefix:
          'Build the feature against the design. Stop at the first acceptance criterion that needs clarification. Keep diffs reviewable.',
        expectedOutput: 'Working code that satisfies the ACs from the spec.',
      },
      {
        name: 'Test',
        role: 'tester',
        promptPrefix:
          'Cover the happy path, edge cases, and at least one regression case for prior bugs in the area. Prefer integration tests where they pay back.',
        expectedOutput: 'A test suite that exercises the spec and guards regressions.',
      },
    ],
  },
  {
    slug: 'exploration',
    name: 'Exploration',
    description: 'Single open-ended chat with the active provider.',
    steps: [
      {
        name: 'Explore',
        role: 'explorer',
        promptPrefix: '',
        expectedOutput: '',
      },
    ],
  },
];
