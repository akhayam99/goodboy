import { useEffect } from 'react';
import { brandId, type BaseDivergence, type Project, type ProjectId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { BoardShellScene } from '../BoardShellScene';

const OPEN_DELAY_MS = 600;
const CHECKED_AGO_MS = 4 * 60_000;

const QUIET_REPOS: ReadonlyArray<string> = [
  'harborline-web',
  'harborline-ios',
  'acme-billing',
  'acme-search',
  'cascadia-maps',
  'cascadia-tiles',
  'northwind-sync',
  'northwind-admin',
  'ledger-export',
  'ledger-audit',
  'payments-console',
  'payments-hooks',
  'notify-email',
  'notify-sms',
  'risk-rules',
  'docs-site',
  'design-tokens',
  'infra-terraform',
];

type ReportParams = {
  readonly state: BaseDivergence['state'];
  readonly ahead?: number;
  readonly behind?: number;
  readonly checkoutBranch?: string;
  readonly message?: string;
};

const reportOf = ({
  state,
  ahead = 0,
  behind = 0,
  checkoutBranch = 'main',
  message,
}: ReportParams): BaseDivergence => ({
  state,
  base: 'main',
  upstream: 'origin/main',
  ahead,
  behind,
  checkoutBranch,
  uncommitted: 0,
  message: message ?? null,
});

type CloneParams = {
  readonly base: Project;
  readonly name: string;
};

const repoOf = ({ base, name }: CloneParams): Project => ({
  ...base,
  id: brandId<ProjectId>({ value: `mock-r4-repo-${name}` }),
  name,
  rootPath: `~/code/harborline/${name}`,
});

const seedRepos = (): void => {
  const state = useAppStore.getState();
  const workspaceId = state.currentWorkspaceId;
  const byName = new Map(state.projects.map((project) => [project.name, project]));
  const payments = byName.get('payments-api');
  const relay = byName.get('notify-relay');
  const ledger = byName.get('ledger-core');
  if (
    workspaceId === null ||
    payments === undefined ||
    relay === undefined ||
    ledger === undefined
  ) {
    return;
  }
  const quiet = QUIET_REPOS.map((name) => repoOf({ base: payments, name }));
  const failing = repoOf({ base: payments, name: 'risk-models' });
  useAppStore.setState({
    projects: [...state.projects, ...quiet, failing],
    repoDivergence: {
      [payments.id]: reportOf({ state: 'behind', behind: 3 }),
      [ledger.id]: reportOf({ state: 'behind', behind: 1, checkoutBranch: 'mara/ledger-export' }),
      [relay.id]: reportOf({ state: 'diverged', ahead: 1, behind: 2 }),
      [failing.id]: reportOf({
        state: 'fetch-failed',
        message: 'Could not resolve host: github.com',
      }),
      ...Object.fromEntries(
        quiet.map((project) => [project.id, reportOf({ state: 'up-to-date' })]),
      ),
    },
    repoCheckedAt: { ...state.repoCheckedAt, [workspaceId]: Date.now() - CHECKED_AGO_MS },
    checkRepoDivergence: async () => 'skipped',
    loadProjectGitStatus: async () => undefined,
  });
};

export const R4ReposMixScene = () => {
  useEffect(() => {
    seedRepos();
    const id = window.setTimeout(() => {
      document.querySelector<HTMLButtonElement>('button[data-repo-entry]')?.click();
    }, OPEN_DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);

  return <BoardShellScene />;
};
