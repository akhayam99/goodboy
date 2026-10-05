import type { ReactNode } from 'react';
import type { DiffCommentAnchor, FileDiff, IsoDateTime } from '@goodboy/types';
import type { Tone } from '@goodboy/ui';
import type { ViewedState } from '../../lib/reviewedFiles';

export type DiffThreadAction = {
  readonly id: string;
  readonly label: string;
  readonly isPrimary: boolean;
  readonly onClick: () => void;
};

export type DiffThread = {
  readonly id: string;
  readonly filePath: string;
  readonly anchor: DiffCommentAnchor | null;
  readonly body: string;
  readonly tone: Tone;
  readonly author: string;
  readonly isAgent: boolean;
  readonly createdAt: IsoDateTime;
  readonly statusLabel: string;
  readonly isResolved: boolean;
  readonly footer?: ReactNode;
  readonly canEdit: boolean;
  readonly canClose: boolean;
  readonly canReopen: boolean;
  readonly canDelete?: boolean;
  readonly actions?: ReadonlyArray<DiffThreadAction>;
  readonly lockReason?: string | null;
  readonly meta?: string | null;
};

export type DiffLineTarget = {
  readonly filePath: string;
  readonly anchor: DiffCommentAnchor;
  readonly text: string;
  readonly note?: string;
};

export type DiffComments = {
  readonly threads: ReadonlyArray<DiffThread>;
  readonly submitLabel: string;
  readonly composerLabel: string;
  readonly noun?: string;
  readonly allowFileLevel: boolean;
  readonly fileComposer?: { readonly label: string; readonly submitLabel: string };
  readonly onSubmit: (filePath: string, anchor: DiffCommentAnchor | null, body: string) => void;
  readonly onAskAgent?: (target: DiffLineTarget) => void;
  readonly onEdit?: (id: string, body: string) => void;
  readonly onClose?: (id: string) => void;
  readonly onReopen?: (id: string) => void;
  readonly onDelete?: (id: string) => void;
};

export type DiffViewed = {
  readonly stateOf: (file: FileDiff) => ViewedState;
  readonly onToggle: (file: FileDiff, next: boolean) => void;
};

export type DiffFileActions = {
  readonly onOpenInEditor?: (path: string) => void;
};
