import { useMemo, useState, type ReactNode } from 'react';
import { Plus, RotateCcw } from 'lucide-react';
import { Button, EmptyState, InlineConfirm, OverflowMenu } from '@goodboy/ui';
import type { Workflow } from '@goodboy/types';
import {
  CONCEPT_ICONS,
  CONCEPT_TONE,
  ICON_SIZE,
} from '../../../../../shared/components/conceptIcons';
import {
  builtinWorkflowState,
  restorableBuiltins,
  type RestorableBuiltin,
} from '../../../builtinWorkflowState';
import { WorkflowListRow } from './WorkflowListRow';

type Props = {
  readonly workflows: ReadonlyArray<Workflow>;
  readonly removedBuiltinIds: ReadonlySet<string>;
  readonly workspaceName: string | null;
  readonly isRestoring: boolean;
  readonly tabs: ReactNode;
  readonly importControl: ReactNode;
  readonly onOpen: (workflow: Workflow) => void;
  readonly onNew: () => void;
  readonly onRestore: (slugs: ReadonlyArray<string>) => Promise<void>;
};

const restoreDescription = (restorable: ReadonlyArray<RestorableBuiltin>): string => {
  const verb =
    restorable.length === 1 ? 'goes back to its original steps' : 'go back to their original steps';
  const names = new Intl.ListFormat('en', { type: 'conjunction' }).format(
    restorable.map(({ entry }) => entry.name),
  );
  return `${names} ${verb}. Your own workflows and other workspaces are not touched.`;
};

export const WorkflowList = ({
  workflows,
  removedBuiltinIds,
  workspaceName,
  isRestoring,
  tabs,
  importControl,
  onOpen,
  onNew,
  onRestore,
}: Props) => {
  const [isConfirmingRestore, setIsConfirmingRestore] = useState(false);
  const restorable = useMemo(
    () => restorableBuiltins({ workflows, removedIds: removedBuiltinIds }),
    [workflows, removedBuiltinIds],
  );
  const hasRestorable = restorable.length > 0;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center">{tabs}</div>
        {importControl}
        <Button size="sm" onClick={onNew}>
          <Plus size={ICON_SIZE.row} aria-hidden />
          New workflow
        </Button>
        <OverflowMenu
          label="Workflow actions"
          trigger={<CONCEPT_ICONS.more size={ICON_SIZE.control} aria-hidden />}
          items={[
            {
              kind: 'item',
              key: 'restore',
              label: 'Restore built-in workflows',
              icon: RotateCcw,
              disabled: !hasRestorable,
              ...(!hasRestorable && { description: 'Built-in workflows are unchanged' }),
              onClick: () => setIsConfirmingRestore(true),
            },
          ]}
        />
      </div>
      {isConfirmingRestore && hasRestorable ? (
        <InlineConfirm
          role="alert"
          icon={<RotateCcw size={ICON_SIZE.row} aria-hidden />}
          title={`Restore built-in workflows in ${workspaceName ?? 'this workspace'}?`}
          description={restoreDescription(restorable)}
          confirmLabel={`Restore ${restorable.length}`}
          isBusy={isRestoring}
          onConfirm={async () => {
            await onRestore(restorable.map(({ entry }) => entry.slug));
            setIsConfirmingRestore(false);
          }}
          onCancel={() => setIsConfirmingRestore(false)}
        />
      ) : null}
      {workflows.length === 0 ? (
        <EmptyState
          icon={CONCEPT_ICONS.workflows}
          tone={CONCEPT_TONE.workflows}
          title="No workflows yet"
          description="Create one to chain several agents in a single session, or restore the built-in workflows from the menu."
          size="inline"
          bordered
        />
      ) : (
        <ul aria-label="Workflows" className="flex flex-col">
          {workflows.map((workflow) => (
            <WorkflowListRow
              key={workflow.id}
              workflow={workflow}
              builtin={builtinWorkflowState({ workflow })}
              onOpen={() => onOpen(workflow)}
            />
          ))}
        </ul>
      )}
    </div>
  );
};
