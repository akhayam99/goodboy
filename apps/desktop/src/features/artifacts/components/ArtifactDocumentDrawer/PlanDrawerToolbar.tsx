import { Tooltip } from '@goodboy/ui';
import type { ResolvedAction } from '../../../actions/types';
import type { PlanPrimaryAction } from '../../../plans/usePlanPrimaryAction';
import { PlanEditorActions } from '../PlanEditor/PlanEditorActions';
import type { PlanEditorModel } from '../PlanEditor/usePlanEditor';
import { PlanDrawerReadingActions } from './PlanDrawerReadingActions';

type Props = {
  readonly version: number;
  readonly isPast: boolean;
  readonly action: PlanPrimaryAction;
  readonly editor: PlanEditorModel;
  readonly editAction: ResolvedAction | null;
  readonly onEdit: () => void;
};

export const PlanDrawerToolbar = ({
  version,
  isPast,
  action,
  editor,
  editAction,
  onEdit,
}: Props) => (
  <div data-testid="plan-drawer-toolbar" className="@container flex min-w-0 items-center gap-2">
    <Tooltip
      content={
        editor.conflict === null ? undefined : `Version ${editor.conflict.revision} is available`
      }
    >
      <span
        data-testid="plan-drawer-version"
        className="shrink-0 text-meta tabular-nums text-muted-foreground"
      >
        {editor.conflict === null ? `v${version}` : `v${version} · v${editor.conflict.revision}`}
      </span>
    </Tooltip>
    <span aria-hidden className="min-w-0 flex-1" />
    {isPast ? null : editor.isEditing ? (
      <PlanEditorActions editor={editor} />
    ) : (
      <PlanDrawerReadingActions action={action} editAction={editAction} onEdit={onEdit} />
    )}
  </div>
);
