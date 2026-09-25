import type { ReactNode } from 'react';
import { Button, EmptyState, InlineConfirm, ScrollFade, SectionHeader, cn } from '@goodboy/ui';
import { Plus, RotateCcw } from 'lucide-react';
import { WORKFLOW_LIBRARY } from '@goodboy/core';
import type { Workflow, WorkflowId } from '@goodboy/types';
import {
  CONCEPT_ICONS,
  CONCEPT_TONE,
  ICON_SIZE,
} from '../../../../../shared/components/conceptIcons';
import { PresetCard } from '../../PresetCard';

type Props = {
  readonly presets: ReadonlyArray<Workflow>;
  readonly workspaceName: string | null;
  readonly activeId: WorkflowId | null;
  readonly resetting: boolean;
  readonly confirmReset: boolean;
  readonly setConfirmReset: (value: boolean) => void;
  readonly onSelect: (t: Workflow) => void;
  readonly onNew: () => void;
  readonly onReset: () => void;
  readonly importSection: ReactNode;
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

export const WorkflowsRail = ({
  presets,
  workspaceName,
  activeId,
  resetting,
  confirmReset,
  setConfirmReset,
  onSelect,
  onNew,
  onReset,
  importSection,
}: Props) => {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-3 pb-2 pt-3">
        <SectionHeader
          label="Workflows"
          meta={
            presets.length > 0 ? (
              <span className="text-2xs tabular-nums text-faint-foreground">{presets.length}</span>
            ) : undefined
          }
          action={
            <button
              type="button"
              onClick={onNew}
              aria-label="New workflow"
              className="inline-flex items-center gap-1 rounded-md border border-border-soft px-2 py-1 text-2xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-hover hover:text-foreground"
            >
              <Plus size={11} aria-hidden /> New
            </button>
          }
        />
      </div>

      <ScrollFade className="min-h-0 flex-1" viewportClassName="px-3 pb-3" fadeSize={24}>
        {presets.length === 0 ? (
          <EmptyState
            icon={CONCEPT_ICONS.workflows}
            tone={CONCEPT_TONE.workflows}
            title="No workflows yet"
            description="Create one to chain several agents in a single session, or bring back the built-in workflows."
            size="inline"
            bordered
            action={
              <Button variant="secondary" size="sm" onClick={() => setConfirmReset(true)}>
                <RotateCcw size={ICON_SIZE.row} aria-hidden />
                Restore built-in workflows
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-0.5">
            {presets.map((t) => (
              <PresetCard
                key={t.id}
                template={t}
                active={t.id === activeId}
                onSelect={() => onSelect(t)}
              />
            ))}
          </ul>
        )}
      </ScrollFade>

      <div className="mx-3 mb-3 shrink-0 rounded-lg bg-subtle p-3">{importSection}</div>

      <div className="shrink-0 px-3 pb-3 pt-1 empty:hidden">
        {confirmReset ? (
          <InlineConfirm
            role="alert"
            icon={<RotateCcw size={ICON_SIZE.row} aria-hidden />}
            title={`Restore built-in workflows in ${workspaceName ?? 'this workspace'}?`}
            description={restoreDescription()}
            confirmLabel="Restore"
            isBusy={resetting}
            onConfirm={onReset}
            onCancel={() => setConfirmReset(false)}
          />
        ) : presets.length === 0 ? null : (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className={cn(
              'inline-flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5',
              'text-2xs font-medium text-faint-foreground transition-colors',
              'hover:bg-hover hover:text-foreground',
            )}
          >
            <RotateCcw size={11} aria-hidden /> Restore built-in workflows
          </button>
        )}
      </div>
    </div>
  );
};
