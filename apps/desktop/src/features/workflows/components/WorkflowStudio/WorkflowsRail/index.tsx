import { EmptyState, ResizeHandle, ScrollFade, SectionHeader, Tooltip, cn } from '@goodboy/ui';
import { Check, Layers, Plus, RotateCcw, X } from 'lucide-react';
import type { Workflow, WorkflowId } from '@goodboy/types';
import { useColumnWidth } from '../../../../../shared/hooks/useColumnWidth';
import { STORAGE_KEYS } from '../../../../../shared/lib/storage-keys';
import { PresetCard } from '../../PresetCard';

type Props = {
  readonly presets: ReadonlyArray<Workflow>;
  readonly activeId: WorkflowId | null;
  readonly editing: Workflow | null | 'new';
  readonly resetting: boolean;
  readonly confirmReset: boolean;
  readonly setConfirmReset: (value: boolean) => void;
  readonly onSelect: (t: Workflow) => void;
  readonly onNew: () => void;
  readonly onDelete: (t: Workflow) => void;
  readonly onReset: () => void;
};

export const WorkflowsRail = ({
  presets,
  activeId,
  editing,
  resetting,
  confirmReset,
  setConfirmReset,
  onSelect,
  onNew,
  onDelete,
  onReset,
}: Props) => {
  const [width, setWidth] = useColumnWidth(STORAGE_KEYS.workflowStudioRailWidth, 288);

  return (
    <div className="flex min-h-0 shrink-0">
      <aside className="flex shrink-0 flex-col" style={{ width }}>
        <div className="shrink-0 px-3 pb-2 pt-3">
          <SectionHeader
            label={`Presets (${presets.length})`}
            action={
              <button
                type="button"
                onClick={onNew}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-2xs font-medium transition-colors',
                  editing === 'new'
                    ? 'border-primary/30 bg-primary/10 text-foreground'
                    : 'border-border-soft text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground',
                )}
              >
                <Plus size={11} aria-hidden /> New
              </button>
            }
          />
        </div>

        <ScrollFade className="min-h-0 flex-1" viewportClassName="px-3 pb-3" fadeSize={24}>
          {presets.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No presets yet"
              description="Create one to chain several agents in a single session."
              bordered
            />
          ) : (
            <ul className="flex flex-col gap-0.5">
              {presets.map((t) => (
                <PresetCard
                  key={t.id}
                  template={t}
                  active={t.id === activeId}
                  approved={t.isPreset !== false}
                  onSelect={() => onSelect(t)}
                  onDelete={() => onDelete(t)}
                />
              ))}
            </ul>
          )}
        </ScrollFade>

        <div className="shrink-0 px-3 pb-3 pt-1">
          {confirmReset ? (
            <div className="flex items-center gap-1.5 rounded-lg bg-warning/5 px-2.5 py-2">
              <span className="flex-1 text-2xs leading-tight text-muted-foreground">
                Restore the built-in presets? Your edits to them are overwritten. Custom presets you
                made are kept.
              </span>
              <Tooltip content="confirm restore">
                <span className="inline-flex">
                  <button
                    type="button"
                    onClick={onReset}
                    disabled={resetting}
                    aria-label="confirm restore defaults"
                    className="rounded p-0.5 text-warning transition-colors hover:bg-warning/10 disabled:opacity-50"
                  >
                    <Check size={13} aria-hidden />
                  </button>
                </span>
              </Tooltip>
              <Tooltip content="cancel">
                <span className="inline-flex">
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    disabled={resetting}
                    aria-label="cancel restore defaults"
                    className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
                  >
                    <X size={13} aria-hidden />
                  </button>
                </span>
              </Tooltip>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className={cn(
                'inline-flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5',
                'text-2xs font-medium text-muted-foreground/70 transition-colors',
                'hover:bg-muted/40 hover:text-foreground',
              )}
            >
              <RotateCcw size={11} aria-hidden /> Restore defaults
            </button>
          )}
        </div>
      </aside>
      <ResizeHandle
        value={width}
        min={220}
        max={480}
        onChange={setWidth}
        onReset={() => setWidth(288)}
        ariaLabel="resize workflow studio rail"
      />
    </div>
  );
};
