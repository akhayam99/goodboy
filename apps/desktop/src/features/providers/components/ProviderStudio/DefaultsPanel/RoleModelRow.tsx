import { useEffect, useState } from 'react';
import {
  PROVIDER_CAPABILITIES,
  defaultsForRole,
  recommendedModelForRole,
  resolveRoleRouting,
} from '@goodboy/core';
import type {
  AgentRole,
  ProviderId,
  RoleModelPreference,
  RoleModelPreferences,
} from '@goodboy/types';
import { FieldRow } from '@goodboy/ui';
import {
  EFFORT_LABEL,
  PROVIDER_LABEL,
  modelEffortLevels,
  modelLabel,
} from '../../../../chat/utils/chat-constants';
import { RoutingPicker } from '../../../../../shared/components/RoutingPicker';
import { RoutingStatusControl } from './RoutingStatusControl';

type Props = {
  readonly role: AgentRole;
  readonly label: string;
  readonly help: string;
  readonly preference: RoleModelPreference | null;
  readonly defaultProviderId: ProviderId;
  readonly connectedProviderIds: ReadonlyArray<ProviderId>;
  readonly disabled: boolean;
  readonly onChange: (preference: RoleModelPreference | null) => void;
};

type CommitParams = {
  readonly providerId: ProviderId;
  readonly model: string;
  readonly effort: RoleModelPreference['effort'];
};

export const RoleModelRow = ({
  role,
  label,
  help,
  preference,
  defaultProviderId,
  connectedProviderIds,
  disabled,
  onChange,
}: Props) => {
  const compiled = defaultsForRole(role);
  const prefs: RoleModelPreferences | null = preference == null ? null : { [role]: preference };
  const resolved = resolveRoleRouting({ role, prefs });
  const resolvedProviderId = resolved.isOverride ? resolved.provider : defaultProviderId;
  const [providerId, setProviderId] = useState(resolvedProviderId);
  const availableProviderIds = connectedProviderIds.filter(
    (candidate) => PROVIDER_CAPABILITIES[candidate].models.length > 0,
  );
  const recommendedModel = recommendedModelForRole({ role, provider: providerId });
  const defaultModel = recommendedModelForRole({ role, provider: defaultProviderId });
  const compiledRouting = `${PROVIDER_LABEL[defaultProviderId]} · ${modelLabel(defaultModel)}`;
  const defaultSummary =
    modelEffortLevels(defaultModel) == null
      ? compiledRouting
      : `${compiledRouting} · ${EFFORT_LABEL[compiled.effort]} effort`;

  useEffect(() => {
    setProviderId(resolvedProviderId);
  }, [resolvedProviderId]);

  const commit = ({ providerId: nextProvider, model, effort }: CommitParams) => {
    const candidate: RoleModelPreference = { providerId: nextProvider, model, effort };
    const next = resolveRoleRouting({ role, prefs: { [role]: candidate } });
    if (!next.isOverride) {
      onChange(null);
      return;
    }
    onChange({ providerId: next.provider, model: next.model, effort: next.effort });
  };

  return (
    <FieldRow label={label} help={help}>
      <div className="flex items-center gap-2">
        <RoutingStatusControl
          label={label}
          isCustom={resolved.isOverride}
          disabled={disabled}
          onReset={() => onChange(null)}
        />
        <div className="w-80">
          <RoutingPicker
            ariaLabel={`${label} routing`}
            connectedProviders={availableProviderIds}
            provider={providerId}
            model={resolved.isOverride ? resolved.model : ''}
            effort={resolved.effort}
            recommendedProvider={defaultProviderId}
            recommendedModel={recommendedModel}
            defaultSummary={defaultSummary}
            overridden={resolved.isOverride}
            disabled={disabled}
            onProvider={(next) => {
              if (next === '') {
                onChange(null);
                return;
              }
              setProviderId(next);
              if (!resolved.isOverride) {
                return;
              }
              commit({
                providerId: next,
                model: recommendedModelForRole({ role, provider: next }),
                effort: resolved.effort,
              });
            }}
            onModel={(nextModel) => {
              if (nextModel === '') {
                onChange(null);
                return;
              }
              commit({ providerId, model: nextModel, effort: resolved.effort });
            }}
            onEffort={(effort) =>
              commit({
                providerId,
                model: resolved.isOverride ? resolved.model : recommendedModel,
                effort,
              })
            }
          />
        </div>
      </div>
    </FieldRow>
  );
};
