import type { DotState } from '@goodboy/ui';
import type { ArtifactState } from './artifactStateOf';

type Params = {
  readonly state: ArtifactState;
};

const ARTIFACT_DOT = {
  needs: 'needsYou',
  ready: 'idle',
  approved: 'done',
  autoApproved: 'done',
  available: 'idle',
  running: 'running',
  revising: 'running',
  ran: 'done',
  partly: 'needsYou',
  stopped: 'stopped',
  replaced: 'stopped',
  deleted: 'stopped',
  new: 'unread',
} as const satisfies Record<ArtifactState['key'], DotState>;

export const artifactDotOf = ({ state }: Params): DotState => ARTIFACT_DOT[state.key];
