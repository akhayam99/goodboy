import { ArrowRight } from 'lucide-react';
import type { ProviderId } from '@goodboy/types';
import { ProviderChip } from '../../ProviderChip';

type Props = {
  readonly providerIds: ReadonlyArray<ProviderId>;
  readonly poolIds: ReadonlySet<ProviderId>;
  readonly defaultProviderId: ProviderId;
  readonly disabled: boolean;
  readonly onToggle: (providerId: ProviderId) => void;
};

export const FallbackOrder = ({
  providerIds,
  poolIds,
  defaultProviderId,
  disabled,
  onToggle,
}: Props) => {
  const used = providerIds.filter((id) => poolIds.has(id));
  const unused = providerIds.filter((id) => !poolIds.has(id));
  return (
    <ol
      aria-label="Fallback order"
      className="flex max-w-md flex-wrap items-center justify-end gap-1"
    >
      {used.map((providerId, index) => {
        const isDefaultProvider = providerId === defaultProviderId;
        return (
          <li key={providerId} className="flex items-center gap-1">
            {index > 0 ? (
              <ArrowRight size={11} aria-hidden className="shrink-0 text-faint-foreground" />
            ) : null}
            <span className="text-secondary tabular-nums text-faint-foreground">{index + 1}</span>
            <ProviderChip
              id={providerId}
              selected
              disabled={disabled || isDefaultProvider}
              onClick={() => onToggle(providerId)}
              title={isDefaultProvider ? 'Default provider is always first' : 'Click to stop using'}
            />
          </li>
        );
      })}
      {unused.map((providerId) => (
        <li key={providerId}>
          <ProviderChip
            id={providerId}
            selected={false}
            disabled={disabled}
            onClick={() => onToggle(providerId)}
            title="Click to use"
            trailing={<span>, not used</span>}
          />
        </li>
      ))}
    </ol>
  );
};
