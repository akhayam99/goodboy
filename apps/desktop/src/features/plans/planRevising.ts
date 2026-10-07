import type { AgentId, ArtifactId, SessionArtifact, TurnState } from '@goodboy/types';

export type PlanRevising =
  | Readonly<{ kind: 'none' }>
  | Readonly<{ kind: 'revising'; nextRevision: number }>
  | Readonly<{ kind: 'newVersion' }>;

export const NOT_REVISING: PlanRevising = { kind: 'none' };

export const PLAN_REVISING_REASON = 'The planner is revising this plan';

export const NEW_VERSION_LABEL = 'Writing a new version';

type Params = Readonly<{
  artifact: Pick<SessionArtifact, 'status' | 'revision' | 'sourceTurnId'>;
  turn: TurnState | undefined;
}>;

export const planRevisingOf = ({ artifact, turn }: Params): PlanRevising => {
  if (turn === undefined || (turn.kind !== 'running' && turn.kind !== 'blocked')) {
    return NOT_REVISING;
  }
  if (turn.runId === artifact.sourceTurnId) {
    return NOT_REVISING;
  }
  if (artifact.status === 'active') {
    return { kind: 'revising', nextRevision: artifact.revision + 1 };
  }
  if (artifact.status === 'consumed') {
    return { kind: 'newVersion' };
  }
  return NOT_REVISING;
};

export const planRevisingLabel = ({ revising }: { readonly revising: PlanRevising }): string => {
  switch (revising.kind) {
    case 'revising':
      return `Revising to v${revising.nextRevision}`;
    case 'newVersion':
      return NEW_VERSION_LABEL;
    case 'none':
      return '';
    default: {
      const exhaustive: never = revising;
      return exhaustive;
    }
  }
};

type MapParams = Readonly<{
  artifacts: ReadonlyArray<SessionArtifact>;
  turnStates: Readonly<Partial<Record<AgentId, TurnState>>>;
}>;

export const revisingByPlanId = ({
  artifacts,
  turnStates,
}: MapParams): ReadonlyMap<ArtifactId, PlanRevising> => {
  const out = new Map<ArtifactId, PlanRevising>();
  for (const artifact of artifacts) {
    if (artifact.kind !== 'plan') {
      continue;
    }
    const revising = planRevisingOf({ artifact, turn: turnStates[artifact.agentId] });
    if (revising.kind !== 'none') {
      out.set(artifact.id, revising);
    }
  }
  return out;
};

const sameRevising = (left: PlanRevising | undefined, right: PlanRevising | undefined): boolean => {
  if (left === undefined || right === undefined) {
    return left === right;
  }
  if (left.kind === 'revising' && right.kind === 'revising') {
    return left.nextRevision === right.nextRevision;
  }
  return left.kind === right.kind;
};

export const sameRevisingMaps = (
  left: ReadonlyMap<ArtifactId, PlanRevising>,
  right: ReadonlyMap<ArtifactId, PlanRevising>,
): boolean => {
  if (left.size !== right.size) {
    return false;
  }
  for (const [id, value] of left) {
    if (!sameRevising(value, right.get(id))) {
      return false;
    }
  }
  return true;
};
