import type { ReactNode } from 'react';
import { Divider, EmptyState, InlineConfirm, ScrollFade, SectionHeader, cn } from '@goodboy/ui';
import { Plus, RotateCcw } from 'lucide-react';
import type { Workflow, WorkflowId } from '@goodboy/types';
import {
  CONCEPT_ICONS,
  CONCEPT_TONE,
  ICON_SIZE,
} from '../../../../../shared/components/conceptIcons';
import { PresetCard } from '../../PresetCard';

type Props = {
  readonly presets: ReadonlyArray<Workflow>;
  readonly activeId: WorkflowId | null;
  readonly resetting: boolean;
  readonly confirmReset: boolean;
  readonly setConfirmReset: (value: boolean) => void;
  readonly onSelect: (t: Workflow) => void;
  readonly onNew: () => void;
  readonly onReset: () => void;
  readonly importSection: ReactNode;
};

export const WorkflowsRail = ({
  presets,
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
          label={`Presets (${presets.length})`}
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
            title="No presets yet"
            description="Create one to chain several agents in a single session."
            size="inline"
            bordered
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

      <Divider />
      <div className="shrink-0 px-3 py-3">{importSection}</div>
      <Divider />

      <div className="shrink-0 px-3 pb-3 pt-1">
        {confirmReset ? (
          <InlineConfirm
            role="alert"
            icon={<RotateCcw size={ICON_SIZE.row} aria-hidden />}
            title="Restore the built-in presets?"
            description="Your edits to them are overwritten. Custom presets you made are kept."
            confirmLabel="Restore"
            isBusy={resetting}
            onConfirm={onReset}
            onCancel={() => setConfirmReset(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className={cn(
              'inline-flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5',
              'text-2xs font-medium text-faint-foreground transition-colors',
              'hover:bg-hover hover:text-foreground',
            )}
          >
            <RotateCcw size={11} aria-hidden /> Restore defaults
          </button>
        )}
      </div>
    </div>
  );
};
