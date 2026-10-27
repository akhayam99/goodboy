import { describe, expect, it } from 'vitest';
import { setupSceneAnswer } from './setupSceneAnswer';

const HOME = '/mock';
const HARBORLINE = `${HOME}/Code/harborline`;
const HOME_NAMES = ['code', 'Code', 'dev', 'Developer', 'projects', 'Projects', 'src', 'work'];
const OFFERED = [`${HOME}/Code`, `${HOME}/Documents`];
const REPOS = ['payments-api', 'ledger-core', 'notify-relay'];

type PathParams = {
  readonly path: string;
};

const errorKindOf = ({ path }: PathParams): unknown => {
  const check = setupSceneAnswer({ command: 'validate_git_repo', payload: { path } });
  return typeof check === 'object' && check !== null ? Reflect.get(check, 'errorKind') : undefined;
};

const isRepoAt = ({ path }: PathParams): unknown => {
  const check = setupSceneAnswer({ command: 'validate_git_repo', payload: { path } });
  return typeof check === 'object' && check !== null ? Reflect.get(check, 'isRepo') : undefined;
};

const reposIn = ({ path }: PathParams): ReadonlyArray<unknown> => {
  const found = setupSceneAnswer({ command: 'scan_child_repos', payload: { path } });
  return Array.isArray(found) ? found.map((repo) => Reflect.get(repo, 'name')) : [];
};

describe('the folders the set up story offers', () => {
  it('lists only the home folders that hold the Harborline story', () => {
    const listed = [...HOME_NAMES.map((name) => `${HOME}/${name}`), `${HOME}/Documents`].filter(
      (path) => errorKindOf({ path }) !== 'not_found',
    );
    expect(listed.sort()).toEqual([...OFFERED].sort());
  });

  it.each(OFFERED)('leads %s to the three Harborline repositories', (path) => {
    expect(errorKindOf({ path })).toBe('not_a_repository');
    expect(reposIn({ path })).toEqual(REPOS);
  });

  it('leads the folder the picker returns to the same three repositories', () => {
    expect(reposIn({ path: HARBORLINE })).toEqual(REPOS);
    for (const name of REPOS) {
      expect(isRepoAt({ path: `${HARBORLINE}/${name}` })).toBe(true);
    }
  });
});
