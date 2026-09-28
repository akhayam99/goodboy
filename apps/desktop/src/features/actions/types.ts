import type { LucideIcon } from 'lucide-react';
import type { AgentId, ArtifactId, SessionId, WorkflowRunId } from '@goodboy/types';
import type { ArtifactGeneration } from '../artifacts/artifactCollection';
import type { RecordFacts } from './kinds/record';
import type { PullRequestFacts } from './kinds/pullRequest';
import type { CommitFacts } from './kinds/commit';
import type { DiffFileFacts } from './kinds/diffFile';
import type { MountFacts } from './kinds/mount';
import type { WorktreeFacts } from './kinds/worktree';
import type { ScriptFacts } from './kinds/script';
import type { AppStore } from '../../store/store';
import type { ShowToast } from '../../app/components/Toast';
import type { ShortcutId } from '../../shared/keyboard/registry';

export const ACTION_GROUPS = ['open', 'act', 'copy', 'danger'] as const;

export type ActionGroup = (typeof ACTION_GROUPS)[number];

export type ActionConfirmRole = 'alert' | 'danger';

export type ActionConfirm = {
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly role: ActionConfirmRole;
  readonly notes?: ReadonlyArray<string>;
  readonly altActionId?: string;
};

export type ActionChoice = {
  readonly id: string;
  readonly label: string;
  readonly isCurrent: boolean;
};

export type ActionEmphasis = 'primary' | 'secondary';

export type ActionOrigin = 'menu' | 'overflow' | 'palette' | 'button';

export type ActionEnv = {
  readonly getState: () => AppStore;
  readonly showToast: ShowToast;
  readonly copyText: (params: { readonly text: string }) => Promise<void>;
  readonly origin: ActionOrigin;
  readonly anchorKey: string | null;
};

export type FactsParams<F> = {
  readonly facts: F;
};

export type ActionRunParams<F> = {
  readonly facts: F;
  readonly env: ActionEnv;
  readonly choice: string | null;
};

export type ActionDefinition<F> = {
  readonly id: string;
  readonly label: string | ((params: FactsParams<F>) => string);
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
  readonly emphasis?: (params: FactsParams<F>) => ActionEmphasis | null;
  readonly isBusy?: (params: FactsParams<F>) => boolean;
  readonly run: (params: ActionRunParams<F>) => void | Promise<void>;
};

export type FactsSourceParams<T> = {
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
  readonly icon: LucideIcon;
  readonly group: ActionGroup;
  readonly shortcut: ShortcutId | null;
  readonly description: string | null;
  readonly blockedReason: string | null;
  readonly confirm: ActionConfirm | null;
  readonly isUndoable: boolean;
  readonly choices: ReadonlyArray<ActionChoice> | null;
  readonly emphasis: ActionEmphasis | null;
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
  | 'discard';

export type ArtifactPort = {
  readonly run: () => void | Promise<void>;
  readonly label?: string;
  readonly description?: string | null;
  readonly blockedReason?: string | null;
  readonly isBusy?: boolean;
};

export type ArtifactPorts = Readonly<Partial<Record<ArtifactPortId, ArtifactPort>>>;

export type ArtifactActionSubject =
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
  readonly facts: PullRequestFacts;
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
  readonly facts: MountFacts;
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

export type LinkActionTarget = {
  readonly kind: 'link';
  readonly href: string;
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
  | CommitActionTarget
  | DiffFileActionTarget
  | MountActionTarget
  | WorktreeActionTarget
  | ScriptActionTarget
  | MessageActionTarget
  | LinkActionTarget;
