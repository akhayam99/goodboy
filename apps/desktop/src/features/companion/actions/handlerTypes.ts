import type { AutoPlanApproval } from '../../auto/plan/approveAutoPlan';
import type { AgentId, ArtifactId, SessionId } from '@goodboy/types';
import type { AppStore } from '../../../store/store';
import type { Refusal } from '../contract/actions';
import type { ActionId } from '../contract/primitives';

export type HandlerResult =
  | { readonly kind: 'done'; readonly undoActionId: ActionId | null }
  | { readonly kind: 'refused'; readonly refusal: Refusal }
  | { readonly kind: 'failed'; readonly error: string };

export type ApprovePlanPortParams = {
  readonly sessionId: SessionId;
  readonly rootAgentId: AgentId;
  readonly artifactId: ArtifactId;
  readonly expectedRevision: number;
};

export type DecidePorts = {
  readonly approvePlan: (params: ApprovePlanPortParams) => Promise<AutoPlanApproval>;
};

export type HandlerParams<Action> = {
  readonly action: Action;
  readonly getStore: () => AppStore;
  readonly ports: DecidePorts;
};
