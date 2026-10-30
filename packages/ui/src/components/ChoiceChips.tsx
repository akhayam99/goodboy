import { useEffect, useRef, type RefObject } from 'react';
import { cn } from '../cn';
import { Button } from './Button';
import { Chip } from './Chip';
import { nextEnabledIndex } from './tabListKeys';

const MAX_NUMBERED = 9;

export type ChoiceChipOption<T extends string = string> = {
  readonly value: T;
  readonly label: string;
  readonly isRecommended?: boolean;
  readonly isDisabled?: boolean;
};

export type ChoiceChipsProps<T extends string = string> = {
  readonly options: ReadonlyArray<ChoiceChipOption<T>>;
  readonly value: T | null;
  readonly onChange: (value: T) => void;
  readonly ariaLabel: string;
  readonly keyScope?: RefObject<HTMLElement | null>;
  readonly className?: string;
};

type MoveParams = {
  readonly key: string;
  readonly index: number;
  readonly options: ReadonlyArray<{ readonly isDisabled?: boolean }>;
};

const moveTargetOf = ({ key, index, options: chips }: MoveParams): number | null => {
  const options = chips.map((chip) => ({ disabled: chip.isDisabled === true }));
  if (key === 'ArrowRight' || key === 'ArrowDown') {
    return nextEnabledIndex({ options, startIndex: index, direction: 1 });
  }
  if (key === 'ArrowLeft' || key === 'ArrowUp') {
    return nextEnabledIndex({ options, startIndex: index, direction: -1 });
  }
  if (key === 'Home') {
    return nextEnabledIndex({ options, startIndex: -1, direction: 1 });
  }
  if (key === 'End') {
    return nextEnabledIndex({ options, startIndex: options.length, direction: -1 });
  }
  return null;
};

type DigitParams = {
  readonly key: string;
  readonly options: ReadonlyArray<{ readonly isDisabled?: boolean }>;
};

const digitTargetOf = ({ key, options }: DigitParams): number | null => {
  if (!/^[1-9]$/.test(key)) {
    return null;
  }
  const index = Number(key) - 1;
  const option = options[index];
  if (option === undefined || option.isDisabled === true) {
    return null;
  }
  return index;
};

export const ChoiceChips = <T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  keyScope,
  className,
}: ChoiceChipsProps<T>) => {
  const groupRef = useRef<HTMLDivElement>(null);
  const isNumbered = options.length <= MAX_NUMBERED;
  const selectedIndex = options.findIndex((option) => option.value === value);
  const firstEnabled = options.findIndex((option) => option.isDisabled !== true);
  const isSelectedEnabled = selectedIndex >= 0 && options[selectedIndex]?.isDisabled !== true;
  const focusIndex = isSelectedEnabled ? selectedIndex : Math.max(0, firstEnabled);

  useEffect(() => {
    const scope = keyScope?.current ?? groupRef.current;
    if (scope === null || !isNumbered) {
      return undefined;
    }
    const controller = new AbortController();
    scope.addEventListener(
      'keydown',
      (event) => {
        const isTyping = event.target instanceof HTMLInputElement;
        if (isTyping || event.metaKey || event.ctrlKey || event.altKey) {
          return;
        }
        const index = digitTargetOf({ key: event.key, options });
        const option = index === null ? undefined : options[index];
        if (option !== undefined) {
          onChange(option.value);
        }
      },
      { signal: controller.signal },
    );
    return () => controller.abort();
  }, [keyScope, isNumbered, options, onChange]);

  return (
    <div
      ref={groupRef}
      role="listbox"
      aria-orientation="horizontal"
      aria-label={ariaLabel}
      className={cn('flex flex-wrap gap-2', className)}
    >
      {options.map((option, index) => {
        const isActive = option.value === value;
        return (
          <Button
            key={option.value}
            variant="secondary"
            role="option"
            aria-selected={isActive}
            tabIndex={index === focusIndex ? 0 : -1}
            disabled={option.isDisabled === true}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              const target = moveTargetOf({ key: event.key, index, options });
              const next = target === null ? undefined : options[target];
              if (target === null || next === undefined) {
                return;
              }
              event.preventDefault();
              onChange(next.value);
              groupRef.current
                ?.querySelectorAll<HTMLButtonElement>('[role="option"]')
                [target]?.focus();
            }}
            className={cn(
              'h-auto min-h-7 max-w-full justify-start whitespace-normal border-0 py-1 text-left',
              isActive && 'bg-selected hover:bg-selected',
            )}
          >
            {isNumbered ? (
              <span className="shrink-0 text-meta font-normal text-faint-foreground">
                {index + 1}
              </span>
            ) : null}
            <span className="min-w-0 break-words text-row">{option.label}</span>
            {option.isRecommended === true ? (
              <Chip
                tone="neutral"
                kind="state"
                bordered={false}
                emphasis="subtle"
                label="Recommended"
              />
            ) : null}
          </Button>
        );
      })}
    </div>
  );
};
