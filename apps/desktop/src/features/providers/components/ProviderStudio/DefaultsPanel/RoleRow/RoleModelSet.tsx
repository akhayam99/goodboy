import { useState } from 'react';
import { Plus } from 'lucide-react';
import { getModelProvider } from '@goodboy/core';
import { ROLE_MODEL_SET_MAX, type EffortLevel, type ProviderId } from '@goodboy/types';
import { Button, StatusDot } from '@goodboy/ui';
import { RoutingPicker } from '../../../../../../shared/components/RoutingPicker';
import { ICON_SIZE } from '../../../../../../shared/components/conceptIcons';
import { RoleModelChip } from './RoleModelChip';
import type { RoleSetEntry } from '../../../../roleSetEntries';

type Choice = Readonly<{ providerId: ProviderId; model: string }>;

type Props = {
  readonly label: string;
  readonly title: string;
  readonly entries: ReadonlyArray<RoleSetEntry>;
  readonly auto: Readonly<{ provider: ProviderId; model: string; effort: EffortLevel }>;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly disabled: boolean;
  readonly onAdd: (choice: Choice) => void;
  readonly onRemove: (index: number) => void;
  readonly onMove: (params: { readonly index: number; readonly offset: -1 | 1 }) => void;
};

const HINT_EMPTY = 'Not set. Auto picks the model, as shown above. Add up to 3 to choose from.';
const HINT_SET =
  'Auto picks one per step by its size, trying them in your order. Alt and the arrow keys move a model.';

export const RoleModelSet = ({
  label,
  title,
  entries,
  auto,
  connectedProviders,
  disabled,
  onAdd,
  onRemove,
  onMove,
}: Props) => {
  const [isPicking, setIsPicking] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<ProviderId>(auto.provider);
  const isFull = entries.length >= ROLE_MODEL_SET_MAX;
  const hasSet = entries.length > 0;
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-row text-foreground">{title}</span>
        {hasSet ? (
          <StatusDot tone="info" size="sm" ariaLabel="Different from the default, Auto decides" />
        ) : null}
      </div>
      <p className="text-meta text-muted-foreground">{hasSet ? HINT_SET : HINT_EMPTY}</p>
      <div role="list" aria-label={`${label} models`} className="flex flex-wrap items-center gap-2">
        {entries.map((entry, index) => (
          <span role="listitem" key={`${entry.choice.providerId}:${entry.choice.model}`}>
            <RoleModelChip
              entry={entry}
              position={index + 1}
              disabled={disabled}
              onRemove={() => onRemove(index)}
              onMove={(offset) => onMove({ index, offset })}
            />
          </span>
        ))}
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled || isFull}
          aria-expanded={isPicking && !isFull}
          onClick={() => setIsPicking((current) => !current)}
        >
          <Plus size={ICON_SIZE.row} aria-hidden />
          {isFull ? `Up to ${ROLE_MODEL_SET_MAX}` : 'Add model'}
        </Button>
      </div>
      {isPicking && !isFull ? (
        <RoutingPicker
          presentation="inline"
          availability="setup"
          ariaLabel={`${label} add model`}
          connectedProviders={connectedProviders}
          provider={pendingProvider}
          model=""
          effort={{ editable: false, value: auto.effort }}
          recommendation={{ provider: auto.provider, model: auto.model, effort: auto.effort }}
          recommendationKind="auto"
          overridden={false}
          disabled={disabled}
          onProvider={(next) => {
            if (next === '') {
              setIsPicking(false);
              return;
            }
            setPendingProvider(next);
          }}
          onModel={(nextModel) => {
            if (nextModel === '') {
              setIsPicking(false);
              return;
            }
            onAdd({ providerId: getModelProvider(nextModel) ?? pendingProvider, model: nextModel });
            setIsPicking(entries.length + 1 < ROLE_MODEL_SET_MAX);
          }}
        />
      ) : null}
    </section>
  );
};
