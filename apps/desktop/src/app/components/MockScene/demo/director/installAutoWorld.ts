import {
  brandId,
  type MountId,
  type ProviderRunId,
  type SessionProjectMount,
  type TurnEvent,
} from '@goodboy/types';
import { nowIso } from '../../../../../store/slices/project-mounts/nowIso';
import { AUTO_SESSION, IMPLEMENTER_ID, TESTER_ID } from '../../scenes/u24/autoSceneSeed';
import { BRAND_PROJECTS, BRAND_SESSION } from '../../scenes/brand/canon';
import { AUTO_STORY, LEDGER_ID } from './autoStory';
import type { DirectorStore } from './directorTypes';

type Params = {
  readonly store: DirectorStore;
};

const TESTS_BRANCH = 'hl/redelivery-tests';

type MountParams = {
  readonly mount: SessionProjectMount;
  readonly name: string;
  readonly branch: string;
  readonly index: number;
};

const mountOf = ({ mount, name, branch, index }: MountParams): SessionProjectMount => ({
  ...mount,
  mountName: name,
  branch,
  parallelIndex: index,
  worktreePath: `~/code/harborline/${name}-${branch.split('/').at(-1) ?? 'work'}`,
  repoRoot: `~/code/harborline/${name}`,
});

type BriefParams = {
  readonly runId: string;
  readonly text: string;
};

const briefOf = ({ runId, text }: BriefParams): TurnEvent => ({
  kind: 'user_text',
  runId: brandId<ProviderRunId>({ value: `demo-brief-${runId}` }),
  text,
  at: nowIso({}),
  deliveredBy: 'auto',
});

export const installAutoWorld = ({ store }: Params): void => {
  const sessionId = AUTO_SESSION.id;
  store.setState((current) => {
    const mounts = current.sessionProjectMounts[sessionId] ?? [];
    const [payments, second, relay] = mounts;
    if (payments === undefined || second === undefined || relay === undefined) {
      return {};
    }
    const next: ReadonlyArray<SessionProjectMount> = [
      mountOf({
        mount: payments,
        name: BRAND_PROJECTS.payments.name,
        branch: BRAND_SESSION.branch,
        index: 0,
      }),
      mountOf({
        mount: { ...second, mountId: brandId<MountId>({ value: 'demo-mount-payments-tests' }) },
        name: BRAND_PROJECTS.payments.name,
        branch: TESTS_BRANCH,
        index: 1,
      }),
      mountOf({
        mount: relay,
        name: BRAND_PROJECTS.ledger.name,
        branch: BRAND_SESSION.branch,
        index: 0,
      }),
    ];
    return {
      projects: current.projects.map((project) =>
        project.id === relay.projectId
          ? {
              ...project,
              name: BRAND_PROJECTS.ledger.name,
              rootPath: BRAND_PROJECTS.ledger.rootPath,
            }
          : project,
      ),
      sessionProjectMounts: { ...current.sessionProjectMounts, [sessionId]: next },
      sessionActiveMount: { ...current.sessionActiveMount, [sessionId]: payments.mountId },
      sessionWorktrees: {
        ...current.sessionWorktrees,
        [sessionId]: next.map((mount) => mount.worktreePath),
      },
      sessionExternalTasks: {
        ...current.sessionExternalTasks,
        [sessionId]: (current.sessionExternalTasks[sessionId] ?? []).map((task) =>
          task.provider === 'sentry' ? { ...task, identifier: 'PAYMENTS-API-4F2' } : task,
        ),
      },
      sessionGithub: {
        ...current.sessionGithub,
        ...(current.sessionGithub[sessionId] === undefined
          ? {}
          : {
              [sessionId]: { ...current.sessionGithub[sessionId], linkedIssues: [], pr: null },
            }),
      },
      sessionWorkflows: { ...current.sessionWorkflows, [sessionId]: [] },
      transcripts: {
        ...current.transcripts,
        [IMPLEMENTER_ID]: [briefOf({ runId: 'implementer', text: AUTO_STORY.implementerTask })],
        [TESTER_ID]: [briefOf({ runId: 'tester', text: AUTO_STORY.testerTask })],
        [LEDGER_ID]: [briefOf({ runId: 'ledger', text: AUTO_STORY.ledgerTask })],
      },
      mountGithub: {},
      sessionProjectPrs: { ...current.sessionProjectPrs, [sessionId]: {} },
      sessionEvents: {
        ...current.sessionEvents,
        [sessionId]: (current.sessionEvents[sessionId] ?? []).filter(
          (event) => event.kind !== 'pr_created' && event.kind !== 'pr_merged',
        ),
      },
    };
  });
};
