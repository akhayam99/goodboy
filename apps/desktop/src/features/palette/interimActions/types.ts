import type { LucideIcon } from 'lucide-react';
import type { AgentId, SessionId } from '@goodboy/types';
import type { AppStore } from '../../../store/store';
import type { ShowToast } from '../../../app/components/Toast';
import type { ShortcutId } from '../../../shared/keyboard/registry';

export const ACTION_GROUPS = ['open', 'act', 'copy', 'danger'] as const;

export type ActionGroup = (typeof ACTION_GROUPS)[number];

export type ActionConfirm = {
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly role: 'alert' | 'danger';
  readonly altActionId?: string;
};

export type CopyTextParams = {
  readonly text: string;
};

export type ActionEnv = {
  readonly getState: () => AppStore;
  readonly showToast: ShowToast;
  readonly copyText: (params: CopyTextParams) => Promise<void>;
  readonly origin: 'menu' | 'overflow' | 'palette' | 'button';
  readonly anchorKey: string | null;
};

export type FactsParams<F> = {
  readonly facts: F;
};

export type ActionRunParams<F> = {
  readonly facts: F;
  readonly env: ActionEnv;
};

export type ActionDefinition<F> = {
  readonly id: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly group: ActionGroup;
  readonly shortcut?: ShortcutId;
  readonly when: (params: FactsParams<F>) => boolean;
  readonly blockedReason?: (params: FactsParams<F>) => string | null;
  readonly confirm?: (params: FactsParams<F>) => ActionConfirm | null;
  readonly isUndoable?: boolean;
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
};

export type SessionActionTarget = {
  readonly kind: 'session';
  readonly sessionId: SessionId;
};

export type AgentActionTarget = {
  readonly kind: 'agent';
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

export type ObjectTarget = SessionActionTarget | AgentActionTarget;
