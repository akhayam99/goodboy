import { AnchoredPopover, useDropdown } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { ProviderChip } from '../../../../providers/components/ProviderChip';
import { PROVIDER_LABEL } from '../../../../providers/providerLabel';
import { toggledProviderPool } from '../providerPool';
import { ControlChip } from './ControlChip';

type Props = {
  readonly providers: ReadonlyArray<ProviderId>;
  readonly pool: ReadonlyArray<ProviderId> | null;
  readonly disabled: boolean;
  readonly onChange: (pool: ReadonlyArray<ProviderId> | null) => void;
};

type ValueParams = {
  readonly providers: ReadonlyArray<ProviderId>;
  readonly pool: ReadonlyArray<ProviderId> | null;
};

const chipValueOf = ({ providers, pool }: ValueParams): string => {
  if (pool === null) {
    return providers.length === 1 ? PROVIDER_LABEL[providers[0]!] : 'Every provider';
  }
  return pool.map((provider) => PROVIDER_LABEL[provider]).join(', ');
};

export const ProviderPoolChip = ({ providers, pool, disabled, onChange }: Props) => {
  const dropdown = useDropdown({ disabled, width: 'w-72' });
  const { open, toggle } = dropdown;
  const selected = pool ?? providers;

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Providers this run can use"
      className="flex flex-col gap-2 p-3"
      trigger={
        <ControlChip
          label="Can use"
          value={chipValueOf({ providers, pool })}
          isOpen={open}
          disabled={disabled}
          onToggle={toggle}
        />
      }
    >
      <p className="text-2xs leading-relaxed text-muted-foreground">
        Every agent the orchestrator starts, and every agent those start, runs on one of these.
      </p>
      <div role="group" aria-label="Providers" className="flex flex-wrap gap-1">
        {providers.map((provider) => {
          const isSelected = selected.includes(provider);
          const isLast = isSelected && selected.length === 1;
          return (
            <ProviderChip
              key={provider}
              id={provider}
              selected={isSelected}
              disabled={disabled || isLast}
              title={isLast ? 'A run needs at least one provider' : undefined}
              onClick={() => onChange(toggledProviderPool({ providers, pool, provider }))}
            />
          );
        })}
      </div>
    </AnchoredPopover>
  );
};
