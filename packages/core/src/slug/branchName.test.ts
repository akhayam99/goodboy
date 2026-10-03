import { describe, expect, it } from 'vitest';
import fixture from './branch-name.fixture.json';
import {
  availableBranchName,
  branchNameProblem,
  branchTemplateProblem,
  buildBranchName,
  DEFAULT_BRANCH_TEMPLATE,
  isValidBranchName,
  MAX_BRANCH_NAME_LENGTH,
  NO_TASK_BRANCH_TEMPLATE,
  nextFreeBranchName,
} from './branchName';

type FixtureCase = {
  readonly name: string;
  readonly input: string;
  readonly problem: string | null;
};

const cases: ReadonlyArray<FixtureCase> = fixture.cases;

describe('branch name validation shared with Rust', () => {
  it('uses the same length budget as the fixture', () => {
    expect(MAX_BRANCH_NAME_LENGTH).toBe(fixture.maxLength);
  });

  it.each(cases.map((entry) => [entry.name, entry] as const))('%s', (_name, entry) => {
    expect(branchNameProblem({ name: entry.input })).toBe(entry.problem);
    expect(isValidBranchName({ name: entry.input })).toBe(entry.problem === null);
  });
});

describe('buildBranchName', () => {
  const values = { prefix: 'hl', slug: 'payments-retry', user: 'Mara Quint' };

  it('keeps the shape of today for the default template', () => {
    expect(buildBranchName({ template: DEFAULT_BRANCH_TEMPLATE, values })).toBe(
      'hl/payments-retry',
    );
    expect(
      buildBranchName({
        template: DEFAULT_BRANCH_TEMPLATE,
        values: { ...values, 'task-id': 'HAR-212' },
      }),
    ).toBe('hl/har-212-payments-retry');
  });

  it('never puts the task id in the template without it', () => {
    expect(
      buildBranchName({
        template: NO_TASK_BRANCH_TEMPLATE,
        values: { ...values, 'task-id': 'HAR-212' },
      }),
    ).toBe('hl/payments-retry');
  });

  it('drops a missing placeholder with the separator after it, or before it at the end', () => {
    const template = '{prefix}/{user}/{task-id}-{slug}';
    expect(buildBranchName({ template, values: { slug: 'payments-retry' } })).toBe(
      'payments-retry',
    );
    expect(buildBranchName({ template: '{slug}-{task-id}', values })).toBe('payments-retry');
    expect(buildBranchName({ template, values: { ...values, 'task-id': 'HAR-212' } })).toBe(
      'hl/mara-quint/har-212-payments-retry',
    );
  });

  it('accepts a prefix with a slash and cleans every part of it', () => {
    expect(
      buildBranchName({
        template: DEFAULT_BRANCH_TEMPLATE,
        values: { ...values, prefix: 'Team/AK/' },
      }),
    ).toBe('team/ak/payments-retry');
  });

  it('builds the bootstrap branch from the same template, without a task', () => {
    expect(
      buildBranchName({
        template: '{prefix}/{task-id}-{slug}',
        values: { prefix: 'hl', slug: 'bootstrap' },
      }),
    ).toBe('hl/bootstrap');
  });
});

describe('availableBranchName', () => {
  const values = { prefix: 'hl', slug: 'payments-retry' };

  it('adds no suffix while the name is free', () => {
    expect(availableBranchName({ template: DEFAULT_BRANCH_TEMPLATE, values, taken: [] })).toBe(
      'hl/payments-retry',
    );
  });

  it('adds -2, then -3, when the names are taken', () => {
    expect(
      availableBranchName({
        template: DEFAULT_BRANCH_TEMPLATE,
        values,
        taken: ['hl/payments-retry'],
      }),
    ).toBe('hl/payments-retry-2');
    expect(
      availableBranchName({
        template: DEFAULT_BRANCH_TEMPLATE,
        values,
        taken: ['hl/payments-retry', 'hl/payments-retry-2'],
      }),
    ).toBe('hl/payments-retry-3');
  });

  it('falls back to a short id once every ordinal is taken', () => {
    const taken = [
      'hl/payments-retry',
      ...Array.from({ length: 98 }, (_, index) => `hl/payments-retry-${index + 2}`),
    ];
    expect(
      availableBranchName({
        template: DEFAULT_BRANCH_TEMPLATE,
        values,
        taken,
        randomSuffix: () => '1a2b3c4d',
      }),
    ).toBe('hl/payments-retry-1a2b3c4d');
  });
});

describe('branchTemplateProblem', () => {
  it('accepts the two presets and a custom template with every placeholder', () => {
    expect(branchTemplateProblem({ template: DEFAULT_BRANCH_TEMPLATE })).toBeNull();
    expect(branchTemplateProblem({ template: NO_TASK_BRANCH_TEMPLATE })).toBeNull();
    expect(branchTemplateProblem({ template: '{prefix}/{user}/{task-id}-{slug}' })).toBeNull();
  });

  it('names what is wrong with a template', () => {
    expect(branchTemplateProblem({ template: '{prefix}/{ticket}-{slug}' })).toBe(
      'unknown-placeholder',
    );
    expect(branchTemplateProblem({ template: '{prefix}/{task-id}' })).toBe('missing-slug');
    expect(branchTemplateProblem({ template: '{prefix}/x..{slug}' })).toBe('double-dot');
    expect(branchTemplateProblem({ template: '{prefix}/{slug} copy' })).toBe('whitespace');
  });
});

describe('nextFreeBranchName', () => {
  it('keeps a free name and adds -2 to a taken one, prefix and all', () => {
    expect(nextFreeBranchName({ name: 'team/ak/payments-retry', taken: [] })).toBe(
      'team/ak/payments-retry',
    );
    expect(
      nextFreeBranchName({ name: 'team/ak/payments-retry', taken: ['team/ak/payments-retry'] }),
    ).toBe('team/ak/payments-retry-2');
  });
});
