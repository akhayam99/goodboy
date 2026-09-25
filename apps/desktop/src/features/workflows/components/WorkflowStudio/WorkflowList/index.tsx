import { useState, type ReactNode } from 'react';
import { Plus, RotateCcw } from 'lucide-react';
import { Button, EmptyState, InlineConfirm, OverflowMenu } from '@goodboy/ui';
import { WORKFLOW_LIBRARY } from '@goodboy/core';
import type { Workflow } from '@goodboy/types';
import {
  CONCEPT_ICONS,
  CONCEPT_TONE,
  ICON_SIZE,
} from '../../../../../shared/components/conceptIcons';
import { builtinWorkflowState } from '../../../builtinWorkflowState';
import { WorkflowListRow } from './WorkflowListRow';

type Props = {
  readonly workflows: ReadonlyArray<Workflow>;
  readonly workspaceName: string | null;
  readonly isRestoring: boolean;
  readonly tabs: ReactNode;
  readonly importControl: ReactNode;
  readonly onOpen: (workflow: Workflow) => void;
  readonly onNew: () => void;
  readonly onRestore: () => Promise<void>;
};

const BUILTIN_NAMES = WORKFLOW_LIBRARY.map((entry) => entry.name);

const restoreDescription = (): string => {
  const verb =
    BUILTIN_NAMES.length === 1
      ? 'goes back to its original steps'
      : 'go back to their original steps';
  const names = new Intl.ListFormat('en', { type: 'conjunction' }).format(BUILTIN_NAMES);
  return `${names} ${verb}. Your own workflows and other workspaces are not touched.`;
};

export const WorkflowList = ({
  workflows,
  workspaceName,
  isRestoring,
  tabs,
  importControl,
  onOpen,
  onNew,
  onRestore,
}: Props) => {
  const [isConfirmingRestore, setIsConfirmingRestore] = useState(false);

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
              onClick: () => setIsConfirmingRestore(true),
            },
          ]}
        />
      </div>
      {isConfirmingRestore ? (
        <InlineConfirm
          role="alert"
          icon={<RotateCcw size={ICON_SIZE.row} aria-hidden />}
          title={`Restore built-in workflows in ${workspaceName ?? 'this workspace'}?`}
          description={restoreDescription()}
          confirmLabel="Restore"
          isBusy={isRestoring}
          onConfirm={async () => {
            await onRestore();
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
