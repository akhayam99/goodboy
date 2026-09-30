import type {
  AgentId,
  AttachmentInput,
  HandoffDraft,
  MessageAttachment,
  MountId,
  MountTargetSnapshot,
  ProviderId,
  SessionId,
  TurnProviderOverride,
  UserTurnSentVia,
} from '@goodboy/types';
export type { SetFn, GetFn } from '../../slice-types';

export type SendTurnResult = Readonly<{
  blockedOverBudget: boolean;
  isWriterLeaseDenied?: boolean;
}>;

export type SendTurnInput = Readonly<{
  sessionId: SessionId;
  agentId?: AgentId;
  mountId?: MountId;
  mountTarget?: MountTargetSnapshot;
  resolveCopyPath?: string;
  content: string;
  attachments?: ReadonlyArray<AttachmentInput>;
  override?: TurnProviderOverride;
  force?: boolean;
  origin?: 'operator' | 'workflow' | 'mount-continuation';
  handoff?: HandoffDraft;
  sentVia?: UserTurnSentVia;
  permissionOnceAllow?: string;
  retry?: Readonly<{
    attempt: number;
    provider: ProviderId;
    model: string;
    attachmentRefs: ReadonlyArray<MessageAttachment>;
  }>;
}>;

export type WithInput = Readonly<{ input: SendTurnInput }>;

export type TurnLease = {
  path: string | null;
  holder: AgentId | null;
  token: string | null;
  attemptId: string | undefined;
};

export type TurnProgress = {
  assistantText: string;
  providerThreadId: string | null;
  receivedProviderError: boolean;
  receivedStreamError: boolean;
  lastError: unknown;
  turnWasCancelled: boolean;
  shouldAutoAdvanceWorkflow: boolean;
  readonly filesTouchedThisTurn: Set<string>;
  readonly editedPathsThisTurn: Set<string>;
};

export type TurnPhase<T> =
  Readonly<{ isDone: false; value: T }> | Readonly<{ isDone: true; result: SendTurnResult }>;

export type TurnPhaseValue<F extends (...args: never[]) => Promise<TurnPhase<unknown>>> = Extract<
  Awaited<ReturnType<F>>,
  { isDone: false }
>['value'];
