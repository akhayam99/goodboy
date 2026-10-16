import { useMemo, useState, type ReactNode } from 'react';
import { Download, Plus, RotateCcw } from 'lucide-react';
import type { WorkflowRunHistoryRow } from '@goodboy/db';
import { Button, ConfirmPopover, EmptyState, ListGrid, OverflowMenu } from '@goodboy/ui';
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
import { workflowRunsOf } from '../../../workflowRunsOf';
import type { ImportTriggerParams } from '../ImportPopover';
import { WorkflowListRow } from './WorkflowListRow';
import { WORKFLOW_LIST_COLUMNS } from './workflowListColumns';

type Props = {
  readonly workflows: ReadonlyArray<Workflow>;
  readonly removedBuiltinIds: ReadonlySet<string>;
  readonly workspaceName: string | null;
  readonly isRestoring: boolean;
  readonly runs: ReadonlyArray<WorkflowRunHistoryRow> | null;
  readonly isHistoryFailed?: boolean;
  readonly tabs: ReactNode;
  readonly renderImport: (params: ImportParams) => ReactNode;
  readonly onOpen: (workflow: Workflow) => void;
  readonly onShowRuns: (workflow: Workflow) => void;
  readonly onNew: () => void;
  readonly onRestore: (slugs: ReadonlyArray<string>) => Promise<void>;
};

type ImportParams = {
  readonly renderTrigger: ((params: ImportTriggerParams) => ReactNode) | null;
};

const restoreDescription = (restorable: ReadonlyArray<RestorableBuiltin>): string => {
  const verb = restorable.length === 1 ? 'goes back to its' : 'go back to their';
  const names = new Intl.ListFormat('en', { type: 'conjunction' }).format(
    restorable.map(({ entry }) => entry.name),
  );
  return `${names} ${verb} original steps.`;
};

export const WorkflowList = ({
  workflows,
  removedBuiltinIds,
  workspaceName,
  isRestoring,
  runs,
  isHistoryFailed = false,
  tabs,
  renderImport,
  onOpen,
  onShowRuns,
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
        <Button size="sm" onClick={onNew}>
          <Plus size={ICON_SIZE.row} aria-hidden />
          New workflow
        </Button>
        {hasRestorable ? (
          <ConfirmPopover
            role="alert"
            icon={<RotateCcw size={ICON_SIZE.row} aria-hidden />}
            title={`Restore built-in workflows in ${workspaceName ?? 'this workspace'}?`}
            description={restoreDescription(restorable)}
            confirmLabel={`Restore ${restorable.length}`}
            isBusy={isRestoring}
            isOpen={isConfirmingRestore}
            onConfirm={async () => {
              await onRestore(restorable.map(({ entry }) => entry.slug));
              setIsConfirmingRestore(false);
            }}
            onCancel={() => setIsConfirmingRestore(false)}
            trigger={() =>
              renderImport({
                renderTrigger: ({ onToggle }) => (
                  <OverflowMenu
                    label="More workflow actions"
                    items={[
                      {
                        kind: 'item',
                        key: 'import',
                        label: 'Import workflows\u2026',
                        icon: Download,
                        onClick: onToggle,
                      },
                      {
                        kind: 'item',
                        key: 'restore',
                        label: 'Restore built-in workflows\u2026',
                        icon: RotateCcw,
                        onClick: () => setIsConfirmingRestore(true),
                      },
                    ]}
                  />
                ),
              })
            }
          />
        ) : (
          renderImport({ renderTrigger: null })
        )}
      </div>
      {workflows.length === 0 ? (
        <EmptyState
          size="section"
          icon={CONCEPT_ICONS.workflows}
          tone={CONCEPT_TONE.workflows}
          title="No workflows yet"
          description="Create one to chain several agents in a single session, or restore the built-in workflows."
        />
      ) : (
        <ListGrid label="Workflows" columns={WORKFLOW_LIST_COLUMNS}>
          {workflows.map((workflow) => (
            <WorkflowListRow
              key={workflow.id}
              workflow={workflow}
              builtin={builtinWorkflowState({ workflow })}
              runs={runs === null ? null : workflowRunsOf({ runs, workflowId: workflow.id })}
              isHistoryFailed={isHistoryFailed}
              onOpen={() => onOpen(workflow)}
              onShowRuns={() => onShowRuns(workflow)}
            />
          ))}
        </ListGrid>
      )}
    </div>
  );
};
