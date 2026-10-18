import { describe, expect, it } from 'vitest';
import {
  brandId,
  type FolderGitProbe,
  type FolderPurpose,
  type Project,
  type ProjectId,
} from '@goodboy/types';
import { aProject } from '@goodboy/types/testing';
import { folderGitRowOf, type FolderGitRow } from './folderGitRowOf';

const FOLDER: Project = aProject({
  id: brandId<ProjectId>({ value: 'project-acme-notes' }),
  name: 'acme-notes',
  kind: 'folder',
  rootPath: '/work/acme/acme-notes',
});

type ProbeParams = {
  readonly state: FolderGitProbe['state'];
  readonly remoteUrl?: string | null;
};

const probe = ({ state, remoteUrl = null }: ProbeParams): FolderGitProbe => ({
  path: FOLDER.rootPath,
  state,
  rootPath: FOLDER.rootPath,
  branch: 'main',
  commitCount: 2,
  remoteUrl,
});

type Case = {
  readonly name: string;
  readonly kind: Project['kind'];
  readonly purpose: FolderPurpose | null;
  readonly state: FolderGitProbe['state'] | null;
  readonly remoteUrl?: string | null;
  readonly isInPlace?: boolean;
  readonly isFirstLap?: boolean;
  readonly row: FolderGitRow;
};

const CASES: ReadonlyArray<Case> = [
  {
    name: 'a code folder with no git',
    kind: 'folder',
    purpose: 'code',
    state: 'none',
    row: 'no-git',
  },
  { name: 'a folder never probed', kind: 'folder', purpose: null, state: null, row: 'no-git' },
  {
    name: 'a documents folder never says git',
    kind: 'folder',
    purpose: 'documents',
    state: 'none',
    row: 'hidden',
  },
  {
    name: 'an empty documents repository stays quiet',
    kind: 'folder',
    purpose: 'documents',
    state: 'empty',
    row: 'hidden',
  },
  {
    name: 'an empty code repository',
    kind: 'folder',
    purpose: 'code',
    state: 'empty',
    row: 'no-commits',
  },
  {
    name: 'git found in a code folder while a session writes',
    kind: 'folder',
    purpose: 'code',
    state: 'tracked',
    row: 'found',
  },
  {
    name: 'git found, kept in place',
    kind: 'folder',
    purpose: 'code',
    state: 'tracked',
    isInPlace: true,
    row: 'in-place',
  },
  {
    name: 'a documents folder kept in place never says git again',
    kind: 'folder',
    purpose: 'documents',
    state: 'tracked',
    isInPlace: true,
    row: 'hidden',
  },
  {
    name: 'inside a repository, kept to the folder',
    kind: 'folder',
    purpose: 'code',
    state: 'above',
    isInPlace: true,
    row: 'inside',
  },
  {
    name: 'tracked on this Mac only',
    kind: 'repo',
    purpose: 'code',
    state: 'tracked',
    row: 'local',
  },
  {
    name: 'published',
    kind: 'repo',
    purpose: 'code',
    state: 'tracked',
    remoteUrl: 'https://github.com/acme/acme-web.git',
    row: 'hidden',
  },
  {
    name: 'a first lap project',
    kind: 'repo',
    purpose: null,
    state: 'tracked',
    isFirstLap: true,
    row: 'hidden',
  },
];

describe('folderGitRowOf', () => {
  it.each(CASES)('$name', ({ kind, purpose, state, remoteUrl, isInPlace, isFirstLap, row }) => {
    expect(
      folderGitRowOf({
        project: { ...FOLDER, kind },
        purpose,
        probe: state === null ? null : probe({ state, remoteUrl }),
        choice: isInPlace === true ? 'in-place' : null,
        notice: null,
        isFirstLap: isFirstLap === true,
      }),
    ).toBe(row);
  });
});
