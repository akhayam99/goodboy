import { useRef, type KeyboardEvent } from 'react';
import { SelectableRow } from '@goodboy/ui';
import type { ArtifactChoiceOption } from '../../artifactCreationAdapter';

type Props = {
  readonly ariaLabel: string;
  readonly options: ReadonlyArray<ArtifactChoiceOption>;
  readonly value: string;
  readonly onChange: (value: string) => void;
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

export const ArtifactChoiceRows = ({ ariaLabel, options, value, onChange }: Props) => {
  const listRef = useRef<HTMLDivElement>(null);
  const current = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = nextIndex({ key: event.key, current, total: options.length });
    if (target === null) {
      return;
    }
    event.preventDefault();
    const option = options[target];
    if (option === undefined) {
      return;
    }
    onChange(option.value);
    listRef.current?.querySelectorAll('button')[target]?.focus();
  };

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-1"
    >
      {options.map((option, index) => (
        <SelectableRow
          key={option.value}
          role="option"
          selected={option.value === value}
          ariaSelected={option.value === value}
          tabIndex={index === current ? 0 : -1}
          onClick={() => onChange(option.value)}
          className="flex-col gap-0.5 border border-border-soft bg-elevated/30 px-2.5 py-2 data-[selected=true]:border-transparent"
        >
          <span className="text-xs font-medium">{option.label}</span>
          {option.value === value ? (
            <span className="text-2xs font-normal leading-relaxed text-muted-foreground">
              {option.hint}
            </span>
          ) : null}
        </SelectableRow>
      ))}
    </div>
  );
};
