import type { MountId, ProjectId, SessionProjectMount } from '@goodboy/types';
import { brandedId } from '../../../../../features/history/testing/brandedId';
import { useAppStore } from '../../../../../store';
import { SESSION } from '../activityRunSeed';

const LEDGER_PROJECT_ID = brandedId<ProjectId>({ value: 'mock-p18-project-ledger-core' });
const NOTIFY_PROJECT_ID = brandedId<ProjectId>({ value: 'mock-p18-project-notify-relay' });

type MountParams = {
  readonly base: SessionProjectMount;
  readonly key: string;
  readonly projectId: ProjectId;
  readonly name: string;
  readonly branch: string;
  readonly parallelIndex: number;
};

const mountOf = ({
  base,
  key,
  projectId,
  name,
  branch,
  parallelIndex,
}: MountParams): SessionProjectMount => ({
  ...base,
  mountId: brandedId<MountId>({ value: `mock-p18-mount-${key}` }),
  projectId,
  mountName: name,
  worktreePath: `/w/harborline/${name}-${key}`,
  repoRoot: `/w/harborline/${name}`,
  branch,
  parallelIndex,
});

export const seedFourBranches = (): void => {
  useAppStore.setState((state) => {
    const [project] = state.projects;
    const [first] = state.sessionProjectMounts[SESSION.id] ?? [];
    if (project === undefined || first === undefined) {
      return state;
    }
    const mounts = [
      first,
      mountOf({
        base: first,
        key: 'export-batch',
        projectId: LEDGER_PROJECT_ID,
        name: 'ledger-core',
        branch: 'hl/export-batch',
        parallelIndex: 0,
      }),
      mountOf({
        base: first,
        key: 'rounding',
        projectId: LEDGER_PROJECT_ID,
        name: 'ledger-core',
        branch: 'hl/rounding',
        parallelIndex: 1,
      }),
      mountOf({
        base: first,
        key: 'retry-copy',
        projectId: NOTIFY_PROJECT_ID,
        name: 'notify-relay',
        branch: 'hl/retry-copy',
        parallelIndex: 0,
      }),
    ];
    return {
      projects: [
        ...state.projects,
        { ...project, id: LEDGER_PROJECT_ID, name: 'ledger-core' },
        { ...project, id: NOTIFY_PROJECT_ID, name: 'notify-relay' },
      ],
      sessionProjectMounts: { ...state.sessionProjectMounts, [SESSION.id]: mounts },
      sessionPhaseRuns: {
        ...state.sessionPhaseRuns,
        [SESSION.id]: (state.sessionPhaseRuns[SESSION.id] ?? []).map((agent, index) => ({
          ...agent,
          mountId: mounts[index % mounts.length]?.mountId ?? first.mountId,
        })),
      },
    };
  });
};
