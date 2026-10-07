// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { branchChoiceGroup, branchChoiceOrigin, mergeBranchChoices } from './branchChoices';

const local = (name: string, overrides: Partial<{ inUse: boolean }> = {}) => ({
  name,
  inUse: false,
  hasUncommitted: false,
  ...overrides,
});

const remote = (name: string, author = 'Pat Harborline') => ({
  name,
  author,
  sha: 'bbbbbbb2',
  timestamp: 1790000000,
  hasLocal: false,
});

const pr = (headBranch: string, number: number, author: string | null = 'pat-harborline') => ({
  number,
  title: `Work on ${headBranch}`,
  headBranch,
  isDraft: false,
  author,
});

describe('mergeBranchChoices', () => {
  it('keeps local branches first and adds origin branches nobody has locally', () => {
    const choices = mergeBranchChoices({
      locals: [local('ak/own-work')],
      remotes: [remote('grw-1348-cta'), remote('ak/own-work')],
      prs: [],
    });

    expect(choices.map((choice) => [choice.name, choice.source])).toEqual([
      ['ak/own-work', 'local'],
      ['grw-1348-cta', 'remote'],
    ]);
  });

  it('puts open pull requests before plain origin branches and carries number and author', () => {
    const choices = mergeBranchChoices({
      locals: [],
      remotes: [remote('old-experiment', 'Sam Northwind'), remote('grw-1348-cta')],
      prs: [pr('grw-1348-cta', 9900)],
    });

    expect(choices.map((choice) => choice.name)).toEqual(['grw-1348-cta', 'old-experiment']);
    expect(choices[0]).toMatchObject({
      source: 'pr',
      prNumber: 9900,
      author: 'pat-harborline',
      isDraft: false,
    });
    expect(choices[1]).toMatchObject({ source: 'remote', prNumber: null, author: 'Sam Northwind' });
  });

  it('offers a pull request whose branch is not fetched yet', () => {
    const choices = mergeBranchChoices({ locals: [], remotes: [], prs: [pr('acme-sync', 4)] });

    expect(choices).toHaveLength(1);
    expect(choices[0]).toMatchObject({ name: 'acme-sync', source: 'pr', prNumber: 4 });
  });

  it('decorates a local branch with the pull request it backs, without duplicating it', () => {
    const choices = mergeBranchChoices({
      locals: [local('grw-1348-cta', { inUse: true })],
      remotes: [remote('grw-1348-cta')],
      prs: [pr('grw-1348-cta', 9900)],
    });

    expect(choices).toHaveLength(1);
    expect(choices[0]).toMatchObject({ source: 'local', inUse: true, prNumber: 9900 });
  });
});

describe('branchChoiceOrigin', () => {
  it('names the pull request and its author', () => {
    expect(
      branchChoiceOrigin({ choice: { author: 'pat-harborline', prNumber: 9900, isDraft: false } }),
    ).toBe('PR #9900 · pat-harborline');
  });

  it('marks a draft', () => {
    expect(branchChoiceOrigin({ choice: { author: null, prNumber: 12, isDraft: true } })).toBe(
      'Draft PR #12',
    );
  });

  it('says nothing for an own branch', () => {
    expect(branchChoiceOrigin({ choice: { author: null, prNumber: null, isDraft: false } })).toBe(
      null,
    );
  });
});

describe('branchChoiceGroup', () => {
  it('groups by where the branch lives', () => {
    expect(branchChoiceGroup({ source: 'local' })).toBe('On this Mac');
    expect(branchChoiceGroup({ source: 'pr' })).toBe('Open pull requests');
    expect(branchChoiceGroup({ source: 'remote' })).toBe('On origin');
  });
});
