import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { AnchoredPopover, InlineConfirm, Input, useDropdown } from '@goodboy/ui';
import type { Workflow, WorkflowId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { ControlChip } from './ControlChip';
import { PresetPickerOption } from './PresetPickerOption';

type Props = {
  readonly presets: ReadonlyArray<Workflow>;
  readonly selectedId: WorkflowId | null;
  readonly disabled: boolean;
  readonly onSelect: (preset: Workflow) => void;
  readonly onDelete: (preset: Workflow) => Promise<void>;
};

const SEARCH_THRESHOLD = 5;

export const PresetPicker = ({ presets, selectedId, disabled, onSelect, onDelete }: Props) => {
  const dropdown = useDropdown({ disabled, align: 'end', width: 'w-96', expectedHeight: 320 });
  const { open, close, toggle } = dropdown;
  const [query, setQuery] = useState('');
  const [confirmingId, setConfirmingId] = useState<WorkflowId | null>(null);
  const selected = presets.find((preset) => preset.id === selectedId) ?? null;
  const confirming = presets.find((preset) => preset.id === confirmingId) ?? null;
  const needle = query.trim().toLowerCase();
  const shown =
    needle === ''
      ? presets
      : presets.filter((preset) => preset.name.toLowerCase().includes(needle));

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Pick a preset"
      className="flex max-h-96 flex-col gap-1 p-1"
      trigger={
        <ControlChip
          label="Preset"
          value={selected?.name ?? 'Pick a preset'}
          isOpen={open}
          disabled={disabled}
          onToggle={() => {
            setConfirmingId(null);
            toggle();
          }}
        />
      }
    >
      {confirming !== null ? (
        <InlineConfirm
          role="danger"
          surface="plain"
          icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
          title={`Delete ${confirming.name}?`}
          description="Removes this preset from the workspace. Runs that used it keep their steps."
          confirmLabel="Delete preset"
          onConfirm={async () => {
            await onDelete(confirming);
            setConfirmingId(null);
          }}
          onCancel={() => setConfirmingId(null)}
        />
      ) : (
        <>
          {presets.length > SEARCH_THRESHOLD ? (
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search presets"
              aria-label="Search presets"
              className="h-7 bg-background text-label"
            />
          ) : null}
          <div role="listbox" aria-label="Presets" className="flex flex-col">
            {shown.map((preset) => (
              <PresetPickerOption
                key={preset.id}
                preset={preset}
                isSelected={preset.id === selectedId}
                onSelect={() => {
                  onSelect(preset);
                  close();
                }}
                onDelete={() => setConfirmingId(preset.id)}
              />
            ))}
            {shown.length === 0 ? (
              <p className="px-2 py-1.5 text-secondary text-faint-foreground">No preset matches.</p>
            ) : null}
          </div>
        </>
      )}
    </AnchoredPopover>
  );
};
