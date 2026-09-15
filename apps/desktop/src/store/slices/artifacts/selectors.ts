import type {
  ArtifactId,
  ArtifactKind,
  PlanArtifact,
  SessionArtifact,
  SessionId,
} from '@goodboy/types';
import type { AppState } from '../../types';

type ArtifactsSliceState = Pick<AppState, 'sessionArtifacts'>;

type SessionParams = {
  readonly state: ArtifactsSliceState;
  readonly sessionId: SessionId;
};

type KindParams = SessionParams & {
  readonly kind: ArtifactKind;
};

type ArtifactParams = SessionParams & {
  readonly artifactId: ArtifactId;
};

const EMPTY: ReadonlyArray<SessionArtifact> = [];

export const selectSessionArtifacts = ({
  state,
  sessionId,
}: SessionParams): ReadonlyArray<SessionArtifact> => state.sessionArtifacts[sessionId] ?? EMPTY;

export const selectArtifactsByKind = ({
  state,
  sessionId,
  kind,
}: KindParams): ReadonlyArray<SessionArtifact> =>
  selectSessionArtifacts({ state, sessionId }).filter((artifact) => artifact.kind === kind);

export const selectPlanArtifacts = ({
  state,
  sessionId,
}: SessionParams): ReadonlyArray<PlanArtifact> =>
  selectSessionArtifacts({ state, sessionId }).filter(
    (artifact): artifact is PlanArtifact => artifact.kind === 'plan',
  );

export const selectArtifact = ({
  state,
  sessionId,
  artifactId,
}: ArtifactParams): SessionArtifact | null =>
  selectSessionArtifacts({ state, sessionId }).find((artifact) => artifact.id === artifactId) ??
  null;
