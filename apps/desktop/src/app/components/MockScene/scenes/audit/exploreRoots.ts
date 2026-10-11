import type { BootstrapPhase } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { SESSION_ID } from '../artifactSeed';
import { sceneClock } from '../../sceneClock';

const clock = sceneClock({ anchor: '2026-09-14T16:40:00.000Z' });

export type ExploreRoots = 'single' | 'multi' | 'first-lap' | 'scratch' | 'none';

const EXPLORE_ROOTS: ReadonlyArray<ExploreRoots> = [
  'single',
  'multi',
  'first-lap',
  'scratch',
  'none',
];

export const isExploreRoots = (value: string | null): value is ExploreRoots =>
  EXPLORE_ROOTS.some((candidate) => candidate === value);

export const SCRATCH_DIR = '~/.goodboy/scratch/settlement-rounding';

const FIRST_LAP_PHASE: BootstrapPhase = {
  stage: 'first-lap',
  firstLapSessionId: SESSION_ID,
  bootstrapSessionId: null,
  snapshotId: null,
  worktreePath: null,
  branch: null,
  updatedAt: clock.iso({ at: '2026-09-14T16:40:00.000Z' }),
};

type Params = {
  readonly roots: ExploreRoots;
};

export const seedExploreRoots = ({ roots }: Params): void => {
  const state = useAppStore.getState();
  const mounts = state.sessionProjectMounts[SESSION_ID] ?? [];
  const first = mounts[0];
  if (roots === 'multi' || roots === 'single') {
    const shown = roots === 'single' ? mounts.slice(0, 1) : mounts;
    useAppStore.setState({
      sessionProjectMounts: { [SESSION_ID]: shown },
      sessionActiveMount: first === undefined ? {} : { [SESSION_ID]: first.mountId },
    });
    return;
  }
  useAppStore.setState({
    sessionProjectMounts: { [SESSION_ID]: [] },
    sessionActiveMount: {},
    bootstrapPhase:
      roots === 'first-lap' && first !== undefined
        ? { ...state.bootstrapPhase, [first.projectId]: FIRST_LAP_PHASE }
        : state.bootstrapPhase,
  });
};
