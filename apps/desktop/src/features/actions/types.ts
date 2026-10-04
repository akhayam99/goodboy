import type { LucideIcon } from 'lucide-react';
import type {
  AgentId,
  ArtifactId,
  MountId,
  ProjectId,
  SessionExternalTaskProvider,
  SessionId,
  WorkflowRunId,
  WorktreeStatus,
} from '@goodboy/types';
import type { ArtifactGeneration } from '../artifacts/artifactCollection';
import type { RecordFacts } from './kinds/record';
import type { CommitFacts } from './kinds/commit';
import type { DiffFileFacts } from './kinds/diffFile';
import type { WorktreeFacts } from './kinds/worktree';
import type { ScriptFacts } from './kinds/script';
import type { ChatFacts } from './kinds/chat';
import type { ChatsFacts } from './kinds/chats';
import type { AppStore } from '../../store/store';
import type { ShowToast } from '../../shared/components/Toast';
import type { ShortcutId } from '../../shared/keyboard/registry';
import type { RemoteHostKind } from '../../shared/lib/remoteHost';

export const ACTION_GROUPS = ['open', 'act', 'copy', 'danger'] as const;

export type ActionGroup = (typeof ACTION_GROUPS)[number];

const ACTION_SLOTS = [
  'primary',
  'secondary',
  'inline',
  'link',
  'nudge',
  'notice',
  'hover',
  'section',
  'chip',
  'empty',
  'menu',
] as const;

export type ActionSlot = (typeof ACTION_SLOTS)[number];

type ActionConfirmRole = 'primary' | 'alert' | 'danger';

export type ActionConfirm = {
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly role: ActionConfirmRole;
  readonly notes?: ReadonlyArray<string>;
  readonly altActionId?: string;
  readonly goes?: string;
  readonly stays?: string;
  readonly items?: ReadonlyArray<string>;
};

export type ActionChoice = {
  readonly id: string;
  readonly label: string;
  readonly isCurrent: boolean;
  readonly detail?: string;
  readonly keywords?: ReadonlyArray<string>;
};

export const ALL_CHOICES_ID = 'choice.all';

export type ActionOrigin = 'menu' | 'overflow' | 'palette' | 'button';

export type ActionViewing = {
  readonly kind: 'artifact' | 'agent' | 'workflowRun';
  readonly id: string;
};

export type ActionEnv = {
  readonly getState: () => AppStore;
  readonly showToast: ShowToast;
  readonly copyText: (params: { readonly text: string }) => Promise<void>;
  readonly origin: ActionOrigin;
  readonly anchorKey: string | null;
  readonly viewing: ActionViewing | null;
};

type FactsParams<F> = {
  readonly facts: F;
  readonly viewing?: ActionViewing | null;
};

type ActionRunParams<F> = {
  readonly facts: F;
  readonly env: ActionEnv;
  readonly choice: string | null;
};

export type ActionDefinition<F> = {
  readonly id: string;
  readonly label: string | ((params: FactsParams<F>) => string);
  readonly shortLabel?: (params: FactsParams<F>) => string;
  readonly icon: LucideIcon;
  readonly group: ActionGroup;
  readonly shortcut?: ShortcutId;
  readonly description?: (params: FactsParams<F>) => string | null;
  readonly when: (params: FactsParams<F>) => boolean;
  readonly blockedReason?: (params: FactsParams<F>) => string | null;
  readonly confirm?: (params: FactsParams<F>) => ActionConfirm | null;
  readonly isUndoable?: boolean;
  readonly hasCustomConfirm?: boolean;
  readonly choices?: (params: FactsParams<F>) => ReadonlyArray<ActionChoice>;
  readonly slot?: (params: FactsParams<F>) => ActionSlot;
  readonly pendingLabel?: (params: FactsParams<F>) => string;
  readonly isBusy?: (params: FactsParams<F>) => boolean;
  readonly run: (params: ActionRunParams<F>) => void | Promise<void>;
};

type FactsSourceParams<T> = {
  readonly state: AppStore;
  readonly target: T;
};

export type ObjectKindDefinition<T, F> = {
  readonly noun: string;
  readonly facts: (params: FactsSourceParams<T>) => F | null;
  readonly actions: ReadonlyArray<ActionDefinition<F>>;
  readonly adapted?: (params: FactsParams<F>) => ReadonlyArray<ActionDefinition<F>>;
};

export type ResolvedAction = {
  readonly id: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly icon: LucideIcon;
  readonly group: ActionGroup;
  readonly slot: ActionSlot;
  readonly pendingLabel: string | null;
  readonly shortcut: ShortcutId | null;
  readonly description: string | null;
  readonly blockedReason: string | null;
  readonly confirm: ActionConfirm | null;
  readonly isUndoable: boolean;
  readonly choices: ReadonlyArray<ActionChoice> | null;
  readonly isBusy: boolean;
};

export type SessionActionTarget = {
  readonly kind: 'session';
  readonly sessionId: SessionId;
};

export type SessionsActionTarget = {
  readonly kind: 'sessions';
  readonly sessionIds: ReadonlyArray<SessionId>;
};

export type AgentActionTarget = {
  readonly kind: 'agent';
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

export type WorkflowRunActionTarget = {
  readonly kind: 'workflowRun';
  readonly sessionId: SessionId;
  readonly runId: WorkflowRunId;
};

export type PlanPartActionTarget = {
  readonly kind: 'planPart';
  readonly sessionId: SessionId;
  readonly planId: ArtifactId;
  readonly index: number;
  readonly instructions: string;
  readonly agentId: AgentId | null;
};

export type ArtifactPortId =
  | 'runPlan'
  | 'runAgain'
  | 'restore'
  | 'edit'
  | 'regenerate'
  | 'newVariant'
  | 'copySource'
  | 'saveSource'
  | 'openInBrowser'
  | 'showInFinder'
  | 'delete';

export type ArtifactPort = {
  readonly run: () => void | Promise<void>;
  readonly label?: string;
  readonly description?: string | null;
  readonly blockedReason?: string | null;
  readonly isBusy?: boolean;
};

export type ArtifactPorts = Readonly<Partial<Record<ArtifactPortId, ArtifactPort>>>;

type ArtifactActionSubject =
  | {
      readonly kind: 'stored';
      readonly artifactId: ArtifactId;
      readonly isPlanRunning: boolean;
    }
  | { readonly kind: 'generation'; readonly generation: ArtifactGeneration };

export type ArtifactActionTarget = {
  readonly kind: 'artifact';
  readonly sessionId: SessionId;
  readonly subject: ArtifactActionSubject;
  readonly ports?: ArtifactPorts;
};

export type RecordActionTarget = {
  readonly kind: 'record';
  readonly facts: RecordFacts;
};

export type PullRequestActionTarget = {
  readonly kind: 'pullRequest';
  readonly sessionId: SessionId;
  readonly prNumber: number | null;
};

export type DiffActionTarget = {
  readonly kind: 'diff';
  readonly sessionId: SessionId;
  readonly worktreePath: string;
  readonly status: WorktreeStatus | null;
  readonly remoteKind: RemoteHostKind | null;
  readonly patch: string;
  readonly rebaseConflicts: number;
};

export type CommitActionTarget = {
  readonly kind: 'commit';
  readonly facts: CommitFacts;
};

export type DiffFileActionTarget = {
  readonly kind: 'diffFile';
  readonly facts: DiffFileFacts;
};

export type MountActionTarget = {
  readonly kind: 'mount';
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly status: WorktreeStatus | null;
  readonly remoteKind: RemoteHostKind | null;
};

export type ProjectActionTarget = {
  readonly kind: 'project';
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
};

export type WorktreeActionTarget = {
  readonly kind: 'worktree';
  readonly facts: WorktreeFacts;
};

export type ScriptActionTarget = {
  readonly kind: 'script';
  readonly facts: ScriptFacts;
};

export type MessageActionTarget = {
  readonly kind: 'message';
  readonly text: string;
  readonly sessionId: SessionId | null;
  readonly agentId: AgentId | null;
};

export type ChatActionTarget = {
  readonly kind: 'chat';
  readonly facts: ChatFacts;
};

export type ChatsActionTarget = {
  readonly kind: 'chats';
  readonly facts: ChatsFacts;
};

export type LinkActionTarget = {
  readonly kind: 'link';
  readonly href: string;
};

export type ReviewActionTarget = {
  readonly kind: 'review';
  readonly sessionId: SessionId;
};

export type ReviewCommentActionTarget = {
  readonly kind: 'reviewComment';
  readonly sessionId: SessionId;
  readonly threadId: string;
};

export type WriteReviewActionTarget = {
  readonly kind: 'writeReview';
  readonly sessionId: SessionId;
  readonly draftId: string | null;
};

export type TaskActionTarget = {
  readonly kind: 'task';
  readonly sessionId: SessionId;
  readonly provider: SessionExternalTaskProvider;
  readonly externalId: string;
  readonly branch: string | null;
};

export type ObjectTarget =
  | SessionActionTarget
  | SessionsActionTarget
  | AgentActionTarget
  | WorkflowRunActionTarget
  | PlanPartActionTarget
  | ArtifactActionTarget
  | RecordActionTarget
  | PullRequestActionTarget
  | DiffActionTarget
  | CommitActionTarget
  | DiffFileActionTarget
  | MountActionTarget
  | ProjectActionTarget
  | WorktreeActionTarget
  | ScriptActionTarget
  | MessageActionTarget
  | ChatActionTarget
  | ChatsActionTarget
  | LinkActionTarget
  | ReviewActionTarget
  | ReviewCommentActionTarget
  | WriteReviewActionTarget
  | TaskActionTarget;
