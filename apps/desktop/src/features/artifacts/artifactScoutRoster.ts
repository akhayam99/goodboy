import type { AgentId, ArtifactScoutPlanEntry } from '@goodboy/types';
import type { ArtifactMountOption } from './artifactMountChoice';
import type {
  WireframeScoutProgress,
  WireframeScoutProgressState,
} from '../wireframes/wireframeScoutProgress';

export type ArtifactScoutState = WireframeScoutProgressState | 'planned';

export type ArtifactScoutRow = Readonly<{
  key: string;
  name: string;
  state: ArtifactScoutState;
  detail: string | null;
  claims: string | null;
  root: string | null;
  branch: string | null;
  reason: string | null;
}>;

const ROLE_WORDS = /[-_]+/g;

const roleName = ({ roleId }: Readonly<{ roleId: string }>): string =>
  roleId.replace(ROLE_WORDS, ' ').trim();

type RosterParams = Readonly<{
  plan: ReadonlyArray<ArtifactScoutPlanEntry>;
  progress: ReadonlyArray<WireframeScoutProgress>;
  mounts: ReadonlyArray<ArtifactMountOption>;
}>;

export const artifactScoutRoster = ({
  plan,
  progress,
  mounts,
}: RosterParams): ReadonlyArray<ArtifactScoutRow> => {
  const byAgentId = new Map<AgentId, WireframeScoutProgress>(
    progress.map((entry) => [entry.agentId, entry]),
  );
  const planned = plan.map((entry, index) => {
    const live = entry.agentId === null ? undefined : byAgentId.get(entry.agentId);
    const mount = mounts.find((option) => option.mountId === entry.mountId) ?? null;
    return {
      key: entry.agentId ?? `${entry.roleId}-${index}`,
      name: live?.name ?? roleName({ roleId: entry.roleId }),
      state: live?.state ?? 'planned',
      detail: live?.detail ?? null,
      claims: live?.claims ?? null,
      root: entry.root,
      branch: mount?.branch ?? null,
      reason: entry.reason,
    } satisfies ArtifactScoutRow;
  });
  const claimed = new Set(plan.map((entry) => entry.agentId));
  const unplanned = progress
    .filter((entry) => !claimed.has(entry.agentId))
    .map(
      (entry) =>
        ({
          key: entry.agentId,
          name: entry.name,
          state: entry.state,
          detail: entry.detail,
          claims: entry.claims,
          root: null,
          branch: null,
          reason: null,
        }) satisfies ArtifactScoutRow,
    );
  return [...planned, ...unplanned];
};
