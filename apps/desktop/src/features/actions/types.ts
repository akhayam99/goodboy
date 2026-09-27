import type { LucideIcon } from 'lucide-react';
import type { AgentId, SessionId, WorkflowRunId } from '@goodboy/types';
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
  readonly altActionId?: string;
};

export type ActionChoice = {
  readonly id: string;
  readonly label: string;
  readonly isCurrent: boolean;
};

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
  readonly choices?: (params: FactsParams<F>) => ReadonlyArray<ActionChoice>;
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

export type LinkActionTarget = {
  readonly kind: 'link';
  readonly href: string;
};

export type ObjectTarget =
  | SessionActionTarget
  | SessionsActionTarget
  | AgentActionTarget
  | WorkflowRunActionTarget
  | LinkActionTarget;

export type ObjectKindId = ObjectTarget['kind'];
