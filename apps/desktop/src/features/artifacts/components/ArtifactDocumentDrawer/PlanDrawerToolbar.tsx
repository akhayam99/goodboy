import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';
import type { ArtifactState } from '../../artifactStateOf';
import type { ResolvedAction } from '../../../actions/types';
import type { PlanPrimaryAction } from '../../../plans/usePlanPrimaryAction';
import { PlanEditorActions } from '../PlanEditor/PlanEditorActions';
import type { PlanEditorModel } from '../PlanEditor/usePlanEditor';
import { ArtifactStateChip } from '../ArtifactShell/ArtifactStateChip';
import { PlanDrawerReadingActions } from './PlanDrawerReadingActions';

type Props = {
  readonly version: number;
  readonly state: ArtifactState | null;
  readonly isPast: boolean;
  readonly isInline: boolean;
  readonly action: PlanPrimaryAction;
  readonly editor: PlanEditorModel;
  readonly editAction: ResolvedAction | null;
  readonly onEdit: () => void;
  readonly menu: ReactNode;
};

export const PlanDrawerToolbar = ({
  version,
  state,
  isPast,
  isInline,
  action,
  editor,
  editAction,
  onEdit,
  menu,
}: Props) => (
  <div
    data-testid="plan-drawer-toolbar"
    className={cn(
      'flex min-w-0 items-center gap-2',
      isInline ? 'justify-end' : 'flex-wrap gap-y-1',
    )}
  >
    {isPast ? null : <ArtifactStateChip state={state} />}
    <span
      data-testid="plan-drawer-version"
      className="shrink-0 text-meta tabular-nums text-muted-foreground"
    >
      {editor.conflict === null
        ? `v${version}`
        : `v${version} · v${editor.conflict.revision} available`}
    </span>
    {isInline ? null : <span aria-hidden className="min-w-0 flex-1" />}
    {isPast ? null : editor.isEditing ? (
      <PlanEditorActions editor={editor} />
    ) : (
      <PlanDrawerReadingActions action={action} editAction={editAction} onEdit={onEdit} />
    )}
    {menu}
  </div>
);
