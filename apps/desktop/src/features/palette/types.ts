import type { LucideIcon } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import type { ShortcutId } from '../../shared/keyboard/registry';
import type { ObjectTarget, ResolvedAction } from './interimActions/types';
import type { RankCandidate } from './rank';

export type WorkspaceScope = {
  readonly kind: 'workspace';
  readonly workspaceId: WorkspaceId;
};

export type PaletteScope = WorkspaceScope | ObjectTarget;

export type PaletteGroup = 'agent' | 'session' | 'workspace' | 'script' | 'action' | 'help';

export type PaletteKind =
  | 'verb'
  | 'session'
  | 'agent'
  | 'artifact'
  | 'workspace'
  | 'goto'
  | 'setting'
  | 'script'
  | 'action'
  | 'help';

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
  readonly run: () => void;
};
