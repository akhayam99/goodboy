import type {
  IsoDateTime,
  MountId,
  Project,
  ProjectId,
  Session,
  SessionId,
  SessionProjectMount,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { projectById } from '../../../../../store/slices/projects/projectIndex';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import { SESSION, WORKSPACE_ID, seedWorkflowScene } from '../workflowSeed';
import { WORKSPACE_SIBLINGS, seedWorkspaceChrome } from '../audit/workspaceChrome';
import { sceneClock } from '../../sceneClock';

const clock = sceneClock({ anchor: '2026-10-07T10:00:00.000Z' });

const at = (iso: string): IsoDateTime => clock.iso({ at: iso });

const LEDGER_ID = 'mock-pins-project-ledger-core' as ProjectId;
const RELAY_ID = 'mock-pins-project-notify-relay' as ProjectId;
const PAYMENTS_ID = 'mock-pins-project-payments-api' as ProjectId;

const idOf = (slug: string) => `mock-pins-session-${slug}` as SessionId;

type SessionSeed = {
  readonly slug: string;
  readonly goal: string;
  readonly projectId: ProjectId;
  readonly openedAt: string;
};

const SEEDS: ReadonlyArray<SessionSeed> = [
  {
    slug: 'ledger-export',
    goal: 'Reconcile the ledger export',
    projectId: LEDGER_ID,
    openedAt: '2026-10-05T09:00:00.000Z',
  },
  {
    slug: 'payments-pages',
    goal: 'Paginate the payments list',
    projectId: PAYMENTS_ID,
    openedAt: '2026-10-04T09:00:00.000Z',
  },
  {
    slug: 'settlement',
    goal: 'Backfill the settlement dates',
    projectId: LEDGER_ID,
    openedAt: '2026-10-07T09:50:00.000Z',
  },
  {
    slug: 'queue',
    goal: 'Move the ledger export to a queue',
    projectId: LEDGER_ID,
    openedAt: '2026-10-07T09:40:00.000Z',
  },
  {
    slug: 'retries',
    goal: 'Stop notify-relay retries on a 409',
    projectId: RELAY_ID,
    openedAt: '2026-10-07T09:30:00.000Z',
  },
  {
    slug: 'digest',
    goal: 'Write the notify-relay digest',
    projectId: RELAY_ID,
    openedAt: '2026-10-07T09:20:00.000Z',
  },
  {
    slug: 'idempotency',
    goal: 'Add idempotency keys to payments-api',
    projectId: PAYMENTS_ID,
    openedAt: '2026-10-07T09:55:00.000Z',
  },
  {
    slug: 'rate-limit',
    goal: 'Tune the payments rate limiter',
    projectId: PAYMENTS_ID,
    openedAt: '2026-10-07T09:10:00.000Z',
  },
];

const PINNED_SLUGS: ReadonlyArray<string> = ['ledger-export', 'payments-pages'];

const OPEN_SLUG = 'idempotency';

const sessionOf = ({ slug, goal, projectId, openedAt }: SessionSeed): Session => ({
  ...SESSION,
  id: idOf(slug),
  goal,
  state: { kind: 'idle', lastActivityAt: at(openedAt) },
  contextSlots: [],
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: true,
  activeProjectId: projectId,
  createdAt: at('2026-09-20T09:00:00.000Z'),
  updatedAt: at(openedAt),
  lastOpenedAt: at(openedAt),
});

const projectOf = ({
  base,
  id,
  name,
}: {
  readonly base: Project;
  readonly id: ProjectId;
  readonly name: string;
}): Project => ({ ...base, id, name, rootPath: `/mock/northwind/${name}-source` });

const mountOf = ({ session, project }: { readonly session: Session; readonly project: Project }) =>
  ({
    mountId: `mock-pins-mount-${session.id}` as MountId,
    sessionId: session.id as SessionId,
    projectId: project.id,
    mountName: project.name,
    worktreePath: `/mock/northwind/${project.name}/${session.id}`,
    lastWorktreePath: null,
    repoRoot: project.rootPath,
    branch: `northwind/${session.id}`,
    baseBranch: 'main',
    parallelIndex: 0,
    isAttached: true,
    diskState: 'present',
    revision: 1,
  }) satisfies SessionProjectMount;

export const seedPinnedSessions = (): Session => {
  seedWorkflowScene();
  const base = useAppStore.getState().projects[0];
  if (base === undefined) {
    return SESSION;
  }
  const projects = [
    projectOf({ base, id: LEDGER_ID, name: 'ledger-core' }),
    projectOf({ base, id: RELAY_ID, name: 'notify-relay' }),
    projectOf({ base, id: PAYMENTS_ID, name: 'payments-api' }),
  ];
  const sessions = SEEDS.map(sessionOf);
  const open = sessionById(sessions, idOf(OPEN_SLUG));
  if (open === undefined) {
    return SESSION;
  }
  seedWorkspaceChrome({ session: open, siblings: sessions.filter((session) => session !== open) });
  useAppStore.setState({
    projects,
    sessionProjectMounts: Object.fromEntries(
      sessions.flatMap((session) => {
        const project = projectById(projects, session.activeProjectId);
        return project === undefined ? [] : [[session.id, [mountOf({ session, project })]]];
      }),
    ),
    sessionActiveProject: Object.fromEntries(
      SEEDS.map((seed) => [idOf(seed.slug), seed.projectId]),
    ),
    sessionBranches: Object.fromEntries(
      sessions.map((session) => [session.id, `northwind/${session.id}`]),
    ),
    sessionPins: {
      [WORKSPACE_ID]: PINNED_SLUGS.map((slug, index) => ({
        id: idOf(slug),
        at: Date.parse('2026-10-06T09:00:00.000Z') + index,
      })),
    },
    sessionGroupExpanded: { [RELAY_ID]: false },
    sessionViewPrefs: {
      [WORKSPACE_ID]: {
        sort: 'updatedAt',
        group: 'project',
        isArchivedShown: false,
        isFoldOpen: false,
      },
    },
  });
  return open;
};

export const seedSessionCard = (): Session => {
  seedWorkflowScene();
  seedWorkspaceChrome({ session: SESSION, siblings: WORKSPACE_SIBLINGS });
  return SESSION;
};
