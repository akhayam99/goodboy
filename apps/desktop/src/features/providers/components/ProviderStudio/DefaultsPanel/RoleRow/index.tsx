import { useMemo, useState } from 'react';
import {
  PROVIDER_CAPABILITIES,
  isModelHidden,
  resolveStoredModelSelection,
  roleModelSetPreference,
  type AutoContext,
} from '@goodboy/core';
import type { AgentRole, ProviderId, RoleModelChoice, RoleModelPreference } from '@goodboy/types';
import { Collapsible, cn } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';
import { useHiddenModels } from '../../../../hooks/useHiddenModels';
import { hiddenModelNote } from '../hiddenModelNote';
import { RoleHowItRuns } from './RoleHowItRuns';
import { RoleModelSet } from './RoleModelSet';
import { roleRunFacts } from './roleRunFacts';
import { roleSetEntries, type RoleSetEntry } from '../../../../roleSetEntries';
import { roleSetNoun } from '../../../../roleSetNoun';

type Props = {
  readonly role: AgentRole;
  readonly label: string;
  readonly help: string;
  readonly preference: RoleModelPreference | null;
  readonly autoContext: AutoContext;
  readonly isParallelOn: boolean;
  readonly connectedProviderIds: ReadonlyArray<ProviderId>;
  readonly disabled: boolean;
  readonly onChange: (preference: RoleModelPreference | null) => void;
};

type SetSummaryParams = {
  readonly entries: ReadonlyArray<RoleSetEntry>;
};

const setSummary = ({ entries }: SetSummaryParams): string => {
  const shown = entries.find((entry) => !entry.isGone) ?? entries[0];
  if (shown === undefined) {
    return '';
  }
  return entries.length > 1 ? `${shown.label} +${entries.length - 1}` : shown.label;
};

export const RoleRow = ({
  role,
  label,
  help,
  preference,
  autoContext,
  isParallelOn,
  connectedProviderIds,
  disabled,
  onChange,
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const facts = useMemo(
    () => roleRunFacts({ role, autoContext, isParallelOn }),
    [role, autoContext, isParallelOn],
  );
  const entries = useMemo(() => roleSetEntries({ preference }), [preference]);
  const hidden = useHiddenModels();
  const firstLive = entries.find((entry) => !entry.isGone) ?? null;
  const isFirstHidden =
    firstLive !== null &&
    isModelHidden({
      provider: firstLive.choice.providerId,
      hidden,
      key: resolveStoredModelSelection({
        provider: firstLive.choice.providerId,
        id: firstLive.choice.model,
      }).selection.key,
    });
  const summary =
    isFirstHidden && firstLive !== null
      ? hiddenModelNote({
          provider: firstLive.choice.providerId,
          model: firstLive.choice.model,
          isPinned: true,
          job: label,
        })
      : help;
  const availableProviderIds = connectedProviderIds.filter(
    (candidate) => PROVIDER_CAPABILITIES[candidate].models.length > 0,
  );

  const write = (choices: ReadonlyArray<RoleModelChoice>) => {
    onChange(roleModelSetPreference({ choices, effort: preference?.effort ?? facts.auto.effort }));
  };
  const choices = entries.map((entry) => entry.choice);

  const trailing =
    entries.length === 0 ? (
      <span className="inline-flex min-w-0 items-center gap-1 text-label text-muted-foreground">
        <CONCEPT_ICONS.autoRouting
          size={11}
          aria-hidden
          className="shrink-0 text-faint-foreground"
        />
        <span className="truncate">{facts.auto.label}</span>
      </span>
    ) : (
      <span className="truncate text-label text-muted-foreground">{setSummary({ entries })}</span>
    );

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      trigger={
        <span className="flex min-w-0 items-center gap-3">
          <span className="w-32 shrink-0 truncate text-body text-foreground">{label}</span>
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-label',
              isFirstHidden ? 'text-muted-foreground' : 'text-faint-foreground',
            )}
            title={summary}
          >
            {summary}
          </span>
          <span className="flex max-w-[45%] shrink-0 justify-end">{trailing}</span>
        </span>
      }
    >
      {isOpen ? (
        <div className="flex flex-col gap-3 pt-1">
          <RoleHowItRuns label={label} facts={facts} />
          <RoleModelSet
            label={label}
            title={`Models for ${roleSetNoun(role)}`}
            entries={entries}
            auto={facts.auto}
            connectedProviders={availableProviderIds}
            disabled={disabled}
            onAdd={(choice) => write([...choices, choice])}
            onRemove={(index) => write(choices.filter((_, at) => at !== index))}
            onMove={({ index, offset }) => {
              const target = index + offset;
              if (target < 0 || target >= choices.length) {
                return;
              }
              const next = [...choices];
              const [moved] = next.splice(index, 1);
              if (moved === undefined) {
                return;
              }
              next.splice(target, 0, moved);
              write(next);
            }}
          />
        </div>
      ) : null}
    </Collapsible>
  );
};
