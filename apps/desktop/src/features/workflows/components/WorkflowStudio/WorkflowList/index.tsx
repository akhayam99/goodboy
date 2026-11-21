import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Plus, RotateCcw } from '@goodboy/ui/icons';
import type { WorkflowRunHistoryRow } from '@goodboy/db';
import { Button, ConfirmPopover, EmptyState, ICON_SIZE, ListGrid } from '@goodboy/ui';
import type { Workflow } from '@goodboy/types';
import { useRowFocusKeys } from '../../../../../shared/hooks/useRowFocusKeys';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { NAMES } from '../../../../../shared/utils/names';
import { WorkflowListMenu } from '../../../../actions/WorkflowListMenu';
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
  readonly renderImport: (params: ImportParams) => ReactNode;
  readonly onOpen: (workflow: Workflow) => void;
  readonly onShowRuns: (workflow: Workflow) => void;
  readonly onNew: () => void;
  readonly onRestore: (slugs: ReadonlyArray<string>) => Promise<void>;
};

type ImportParams = {
  readonly renderTrigger: ((params: ImportTriggerParams) => ReactNode) | null;
};

const WORKFLOW_ROW = '[data-list-grid-row]';

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
  renderImport,
  onOpen,
  onShowRuns,
  onNew,
  onRestore,
}: Props) => {
  const [isConfirmingRestore, setIsConfirmingRestore] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  useRowFocusKeys({ containerRef: rootRef, rowSelector: WORKFLOW_ROW });
  const restorable = useMemo(
    () => restorableBuiltins({ workflows, removedIds: removedBuiltinIds }),
    [workflows, removedBuiltinIds],
  );
  const hasRestorable = restorable.length > 0;

  return (
    <div ref={rootRef} className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 items-center justify-end gap-2">
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
                  <WorkflowListMenu
                    facts={{
                      canRestore: hasRestorable,
                      onImport: onToggle,
                      onRestore: () => setIsConfirmingRestore(true),
                    }}
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
          description={
            hasRestorable
              ? 'Create one to chain several agents in a single session, or restore the built-in workflows. A run can start from any of them as a preset.'
              : 'Create one to chain several agents in a single session. A run can start from any of them as a preset.'
          }
          action={
            hasRestorable ? (
              <Button
                size="sm"
                variant="secondary"
                isBusy={isRestoring}
                onClick={() => void onRestore(restorable.map(({ entry }) => entry.slug))}
              >
                <RotateCcw size={ICON_SIZE.row} aria-hidden />
                {NAMES.restoreBuiltInWorkflows}
              </Button>
            ) : undefined
          }
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
