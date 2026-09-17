import type { ArtifactContextInventoryRow } from '../artifacts/artifactContextInventory';
import { WIREFRAME_SCOUT_DEADLINE_MS } from './wireframeScoutReports';
import type { WireframeScout } from './wireframeScoutRoles';

export const WIREFRAME_SCOUT_SKIP_NO_MOUNT = 'no mounted project, so nothing is scouted';

export const WIREFRAME_SCOUT_SKIP_BUDGET = 'this session is budget blocked, so nothing is scouted';

export const wireframeScoutSkipRouting = ({ reason }: Readonly<{ reason: string }>): string =>
  `scout routing is blocked, so nothing is scouted: ${reason}`;

export type WireframeScoutPlan =
  | Readonly<{ kind: 'skipped'; reason: string }>
  | Readonly<{
      kind: 'ready';
      root: string;
      rootReason: string;
      scouts: ReadonlyArray<WireframeScout>;
      modelLabel: string;
    }>;

const boundLabel = (): string => `${Math.round(WIREFRAME_SCOUT_DEADLINE_MS / 60_000)} minute bound`;

type RowParams = Readonly<{
  plan: WireframeScoutPlan;
}>;

export const wireframeScoutInventoryRow = ({ plan }: RowParams): ArtifactContextInventoryRow => {
  if (plan.kind === 'skipped') {
    return {
      id: 'scouts',
      label: 'scouts',
      summary: plan.reason,
      state: 'missing',
      detail: ['the wireframe is written from the evidence in this pack alone'],
    };
  }
  const names = plan.scouts.map((scout) => scout.name).join(', ');
  return {
    id: 'scouts',
    label: 'scouts',
    summary: `${plan.scouts.length} scouts read the repository in parallel on ${plan.modelLabel}, one turn each, ${boundLabel()}: ${names}`,
    state: 'included',
    detail: [`root pinned to ${plan.root}`, plan.rootReason],
  };
};
