import { useRef, type KeyboardEvent } from 'react';
import { SelectableRow } from '@goodboy/ui';
import type { MountId } from '@goodboy/types';
import { ARTIFACT_MOUNT_CAP, type ArtifactMountOption } from '../../artifactMountChoice';

type Props = {
  readonly options: ReadonlyArray<ArtifactMountOption>;
  readonly value: ReadonlyArray<MountId>;
  readonly onChange: (mountId: MountId) => void;
};

const nextIndex = ({
  key,
  current,
  total,
}: {
  readonly key: string;
  readonly current: number;
  readonly total: number;
}): number | null => {
  if (key === 'ArrowDown' || key === 'ArrowRight') {
    return (current + 1) % total;
  }
  if (key === 'ArrowUp' || key === 'ArrowLeft') {
    return (current - 1 + total) % total;
  }
  if (key === 'Home') {
    return 0;
  }
  if (key === 'End') {
    return total - 1;
  }
  return null;
};

export const ArtifactMountRows = ({ options, value, onChange }: Props) => {
  const listRef = useRef<HTMLDivElement>(null);
  const current = Math.max(
    0,
    options.findIndex((option) => value.includes(option.mountId)),
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = nextIndex({ key: event.key, current, total: options.length });
    if (target === null) {
      return;
    }
    event.preventDefault();
    listRef.current?.querySelectorAll('button')[target]?.focus();
  };

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-multiselectable
      aria-label="Read from"
      onKeyDown={onKeyDown}
      className="flex min-w-0 flex-wrap gap-1"
      data-testid="artifact-mount-rows"
    >
      {options.map((option, index) => {
        const isSelected = value.includes(option.mountId);
        const isCapped = !isSelected && value.length >= ARTIFACT_MOUNT_CAP;
        return (
          <SelectableRow
            key={option.mountId}
            role="option"
            selected={isSelected}
            ariaSelected={isSelected}
            tabIndex={index === current ? 0 : -1}
            title={isCapped ? `a run reads at most ${ARTIFACT_MOUNT_CAP} repositories` : undefined}
            onClick={() => onChange(option.mountId)}
            className="w-auto items-baseline gap-1.5 border border-border-soft bg-elevated px-2.5 py-1.5 data-[selected=true]:border-transparent"
          >
            <span className="truncate text-label font-medium">{option.mountName}</span>
            <span className="truncate text-secondary font-normal text-muted-foreground">
              {option.branch}
            </span>
          </SelectableRow>
        );
      })}
    </div>
  );
};
