import type { KeyboardEvent } from 'react';
import { PROVIDER_POLICY_STATES, type ProviderPolicyState } from '@goodboy/types';
import { cn } from '@goodboy/ui';
import { POLICY_STATE_LABEL } from '../../policy/policyStateLabel';

type Props = {
  readonly label: string;
  readonly value: ProviderPolicyState;
  readonly onChange: (state: ProviderPolicyState) => void;
};

type StepParams = {
  readonly event: KeyboardEvent<HTMLButtonElement>;
  readonly index: number;
};

export const PolicyStateSegment = ({ label, value, onChange }: Props) => {
  const onKeyDown = ({ event, index }: StepParams) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    event.preventDefault();
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const next = PROVIDER_POLICY_STATES[index + step];
    if (next === undefined) {
      return;
    }
    onChange(next);
    const group = event.currentTarget.parentElement;
    group?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[index + step]?.focus();
  };

  return (
    <span
      role="radiogroup"
      aria-label={label}
      className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-border-soft p-0.5"
    >
      {PROVIDER_POLICY_STATES.map((state, index) => {
        const isChecked = state === value;
        return (
          <button
            key={state}
            type="button"
            role="radio"
            aria-checked={isChecked}
            tabIndex={isChecked ? 0 : -1}
            onClick={() => onChange(state)}
            onKeyDown={(event) => onKeyDown({ event, index })}
            className={cn(
              'rounded-sm px-2 py-0.5 text-label motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
              isChecked
                ? 'bg-selected text-foreground'
                : 'text-muted-foreground hover:bg-hover hover:text-foreground',
            )}
          >
            {POLICY_STATE_LABEL[state]}
          </button>
        );
      })}
    </span>
  );
};
