import type { AgentId, IsoDateTime, OpenQuestionId, WorkflowRunId } from './ids';
import type { PlanId } from './plan';
import type { ProviderId } from './provider-registry';

export type HandoffSender =
  | Readonly<{ kind: 'you' }>
  | Readonly<{ kind: 'orchestrator'; workflowRunId: WorkflowRunId; stepOrdinal: number }>
  | Readonly<{
      kind: 'workflowStep';
      workflowRunId: WorkflowRunId;
      stepOrdinal: number;
      stepCount: number;
    }>
  | Readonly<{ kind: 'resolve'; threadIds: ReadonlyArray<string>; prNumber: number | null }>
  | Readonly<{ kind: 'parent'; parentAgentId: AgentId; label: string }>
  | Readonly<{ kind: 'question'; questionId: OpenQuestionId }>
  | Readonly<{ kind: 'followUp'; sourceAgentId: AgentId }>;

export const HANDOFF_SECTION_KINDS = [
  'ask',
  'goal',
  'earlierSteps',
  'plan',
  'files',
  'threads',
  'scope',
  'profile',
  'role',
] as const;

export type HandoffSectionKind = (typeof HANDOFF_SECTION_KINDS)[number];

export type HandoffRef =
  | Readonly<{
      kind: 'agent';
      agentId: AgentId;
      ordinal: number;
      label: string;
      detail: string | null;
    }>
  | Readonly<{ kind: 'plan'; planId: PlanId; label: string }>
  | Readonly<{ kind: 'file'; label: string; path: string | null }>
  | Readonly<{
      kind: 'thread';
      threadId: string | null;
      label: string;
      author: string | null;
      location: string | null;
      link: string | null;
    }>
  | Readonly<{ kind: 'rule'; label: string; detail: string }>;

export type HandoffSection = Readonly<{
  kind: HandoffSectionKind;
  summary: string;
  bodyMd: string;
  refs: ReadonlyArray<HandoffRef>;
}>;

export type HandoffDraft = Readonly<{
  sender?: HandoffSender;
  instruction?: string;
  goal?: string | null;
  plan?: Readonly<{ id: PlanId; title: string }> | null;
  why?: string | null;
}>;

export type AgentHandoff = Readonly<{
  agentId: AgentId;
  sender: HandoffSender;
  ask: string;
  why: string | null;
  doneWhen: string | null;
  sections: ReadonlyArray<HandoffSection>;
  sentSystem: string | null;
  sentMessage: string;
  provider: ProviderId;
  createdAt: IsoDateTime;
}>;
