import { useEffect } from 'react';
import { brandId, type BaseDivergence, type ProjectId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { BoardShellScene } from '../BoardShellScene';

const PAYMENTS_ID = brandId<ProjectId>({ value: 'mock-board-project-payments-api' });
const RELAY_ID = brandId<ProjectId>({ value: 'mock-board-project-notify-relay' });
const LEDGER_ID = brandId<ProjectId>({ value: 'mock-board-project-ledger-core' });

const OPEN_DELAY_MS = 600;
const CHECKED_AGO_MS = 2 * 60_000;

type ReposSceneConfig = {
  readonly kind: 'behind' | 'dirty' | 'failed' | 'quiet';
  readonly isOpen: boolean;
};

type ReportParams = {
  readonly state: BaseDivergence['state'];
  readonly ahead?: number;
  readonly behind?: number;
  readonly checkoutBranch?: string;
  readonly uncommitted?: number;
  readonly message?: string;
};

const reportOf = ({
  state,
  ahead = 0,
  behind = 0,
  checkoutBranch = 'main',
  uncommitted = 0,
  message,
}: ReportParams): BaseDivergence => ({
  state,
  base: 'main',
  upstream: 'origin/main',
  ahead,
  behind,
  checkoutBranch,
  uncommitted,
  message: message ?? null,
});

type ReportsParams = {
  readonly kind: ReposSceneConfig['kind'];
};

const reportsOf = ({ kind }: ReportsParams): Readonly<Record<ProjectId, BaseDivergence>> => {
  switch (kind) {
    case 'behind':
      return {
        [PAYMENTS_ID]: reportOf({ state: 'behind', behind: 3 }),
        [RELAY_ID]: reportOf({ state: 'diverged', ahead: 1, behind: 2 }),
        [LEDGER_ID]: reportOf({
          state: 'behind',
          behind: 1,
          checkoutBranch: 'mara/ledger-export',
        }),
      };
    case 'dirty':
      return {
        [PAYMENTS_ID]: reportOf({ state: 'behind', behind: 3, uncommitted: 2 }),
        [RELAY_ID]: reportOf({ state: 'up-to-date' }),
        [LEDGER_ID]: reportOf({ state: 'up-to-date' }),
      };
    case 'failed':
      return {
        [PAYMENTS_ID]: reportOf({
          state: 'fetch-failed',
          message: 'Could not resolve host: github.com',
        }),
        [RELAY_ID]: reportOf({ state: 'up-to-date' }),
        [LEDGER_ID]: reportOf({ state: 'up-to-date' }),
      };
    case 'quiet':
      return {
        [PAYMENTS_ID]: reportOf({ state: 'up-to-date' }),
        [RELAY_ID]: reportOf({ state: 'up-to-date' }),
        [LEDGER_ID]: reportOf({ state: 'ahead', ahead: 1 }),
      };
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
};

type Props = {
  readonly config: ReposSceneConfig;
};

export const ReposScene = ({ config }: Props) => {
  useEffect(() => {
    const workspaceId = useAppStore.getState().currentWorkspaceId;
    useAppStore.setState((state) => ({
      repoDivergence: reportsOf({ kind: config.kind }),
      repoCheckedAt:
        workspaceId === null
          ? state.repoCheckedAt
          : { ...state.repoCheckedAt, [workspaceId]: Date.now() - CHECKED_AGO_MS },
      checkRepoDivergence: async () => 'skipped',
      loadProjectGitStatus: async () => undefined,
    }));
    if (!config.isOpen) {
      return;
    }
    const id = window.setTimeout(() => {
      document.querySelector<HTMLButtonElement>('button[data-repo-entry]')?.click();
    }, OPEN_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [config.isOpen, config.kind]);

  return <BoardShellScene />;
};
