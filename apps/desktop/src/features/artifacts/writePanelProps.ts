import type { AgentId, Session } from '@goodboy/types';
import type { GeneratedArtifactKind } from './artifactCollection';

export type WritePanelProps = {
  readonly session: Session;
  readonly kind: GeneratedArtifactKind;
  readonly note: string | null;
  readonly actionsHost: HTMLElement | null;
  readonly onStarted: (agentId: AgentId) => void;
  readonly onClose: () => void;
};
