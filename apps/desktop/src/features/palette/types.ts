import type { LucideIcon } from 'lucide-react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import type { ShortcutId } from '../../shared/keyboard/registry';
import type {
  ActionConfirm,
  AgentActionTarget,
  CommitActionTarget,
  ExploreFileActionTarget,
  ObjectTarget,
  PullRequestActionTarget,
  ResolvedAction,
  SessionActionTarget,
  WorkflowRunActionTarget,
} from '../actions/types';
import type { RankCandidate } from './rank';

type WorkspaceScope = {
  readonly kind: 'workspace';
  readonly workspaceId: WorkspaceId;
};

export type CommitScope = CommitActionTarget & {
  readonly sessionId: SessionId;
};

export type HeldScope = CommitScope | ExploreFileActionTarget;

export type PaletteScope =
  | WorkspaceScope
  | SessionActionTarget
  | AgentActionTarget
  | WorkflowRunActionTarget
  | PullRequestActionTarget
  | HeldScope;

type PaletteGroup =
  'agent' | 'session' | 'workspace' | 'skill' | 'workflow' | 'script' | 'action' | 'help';

export type PaletteKind =
  | 'verb'
  | 'session'
  | 'agent'
  | 'artifact'
  | 'workspace'
  | 'goto'
  | 'setting'
  | 'script'
  | 'workflow'
  | 'action'
  | 'page'
  | 'next'
  | 'run'
  | 'needs'
  | 'level'
  | 'help';

type PaletteLevelRequest =
  | { readonly kind: 'actions'; readonly target: ObjectTarget }
  | { readonly kind: 'start-run' }
  | { readonly kind: 'confirm-run'; readonly workflowId: string };

export type PaletteEntry = RankCandidate & {
  readonly kind: PaletteKind;
  readonly group: PaletteGroup | null;
  readonly icon: LucideIcon;
  readonly accent?: string;
  readonly detail?: string;
  readonly tag?: string;
  readonly shortcut?: ShortcutId;
  readonly target?: ObjectTarget;
  readonly action?: ResolvedAction;
  readonly confirm?: ActionConfirm;
  readonly level?: PaletteLevelRequest;
  readonly run: () => void;
};
