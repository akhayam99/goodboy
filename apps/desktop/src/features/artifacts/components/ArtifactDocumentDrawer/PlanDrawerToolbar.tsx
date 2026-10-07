import type { ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import { Button, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { ArtifactState } from '../../artifactStateOf';
import type { ResolvedAction } from '../../../actions/types';
import { PlanPrimaryButton } from '../../../plans/planSurfaces';
import type { PlanPrimaryAction } from '../../../plans/usePlanPrimaryAction';
import { PlanEditorActions } from '../PlanEditor/PlanEditorActions';
import type { PlanEditorModel } from '../PlanEditor/usePlanEditor';
import { ArtifactStateChip } from '../ArtifactShell/ArtifactStateChip';

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
      {`v${version}`}
    </span>
    {isInline ? null : <span aria-hidden className="min-w-0 flex-1" />}
    {isPast ? null : editor.isEditing ? (
      <PlanEditorActions editor={editor} />
    ) : (
      <>
        <PlanPrimaryButton action={action} isReasonShown={false} />
        {editAction === null ? null : (
          <Button
            variant="ghost"
            size="sm"
            disabled={editAction.blockedReason !== null}
            title={editAction.blockedReason ?? undefined}
            onClick={onEdit}
            data-testid="plan-drawer-edit"
          >
            <Pencil size={ICON_SIZE.row} aria-hidden />
            Edit
          </Button>
        )}
      </>
    )}
    {menu}
  </div>
);
