// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { aProject } from '@goodboy/types/testing';
import { taskFolderCandidates } from './taskFolderCandidates';

const PROJECTS = [aProject({ name: 'web' }), aProject({ name: 'ledger-core' })];

type NamesParams = {
  readonly text: string;
};

const namesFor = ({ text }: NamesParams): ReadonlyArray<string> =>
  taskFolderCandidates({
    projects: PROJECTS,
    pinnedProjectIds: [],
    linkedProjectIds: [],
    text,
  }).map((candidate) => candidate.name);

describe('taskFolderCandidates', () => {
  it('mounts a long name written as a plain word', () => {
    expect(namesFor({ text: 'Fix the ledger-core totals' })).toEqual(['ledger-core']);
  });

  it('does not mount a short name the task merely says', () => {
    expect(namesFor({ text: 'Fix the web login page' })).toEqual([]);
  });

  it('mounts a short name written in backticks', () => {
    expect(namesFor({ text: 'Fix the login page in `web`' })).toEqual(['web']);
  });

  it('mounts a short name written as owner/repo', () => {
    expect(namesFor({ text: 'Fix the login page in acme/web' })).toEqual(['web']);
  });

  it('does not mount a short name after a bare slash', () => {
    expect(namesFor({ text: 'Fix the /web route' })).toEqual([]);
  });
});
