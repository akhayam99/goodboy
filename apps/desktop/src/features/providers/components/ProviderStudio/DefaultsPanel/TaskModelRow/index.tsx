import {
  PROVIDER_CAPABILITIES,
  clampEffortForModel,
  isModelHidden,
  resolveStoredModelSelection,
} from '@goodboy/core';
import { resolveLimitedTaskModel } from '../../../../../../store/slices/providerLimits/resolveLimitedTaskModel';
import { Chip } from '@goodboy/ui';
import type {
  AuxTaskId,
  EffortLevel,
  ProviderId,
  ProviderPolicy,
  TaskModelPreference,
} from '@goodboy/types';
import { RoutingPicker } from '../../../../../../shared/components/RoutingPicker';
import { savedRouteEffort } from '../../../../../../shared/components/RoutingPicker/savedRouteEffort';
import { AUTO_RECOMMENDATION_COPY } from '../../../../../../shared/components/RoutingPicker/autoRecommendationCopy';
import { autoLimitReason } from '../../../../../../shared/components/RoutingPicker/autoLimitReason';
import { useAutoLimitContext } from '../../../../hooks/useAutoLimitContext';
import { DefaultRow } from '../DefaultRow';
import { FallbackRow, type FallbackChoice } from '../FallbackRow';
import { useHiddenModels } from '../../../../hooks/useHiddenModels';
import { hiddenModelNote } from '../hiddenModelNote';
import { taskSkippedLine } from './taskSkippedLine';

const DEFAULT_EFFORT: EffortLevel = 'medium';

type Props = {
  readonly task: AuxTaskId;
  readonly label: string;
  readonly help: string;
  readonly preference: TaskModelPreference | null;
  readonly defaultProviderId: ProviderId;
  readonly providerPolicy: ProviderPolicy | null;
  readonly connectedProviderIds: ReadonlyArray<ProviderId>;
  readonly disabled: boolean;
  readonly onChange: (preference: TaskModelPreference | null) => void;
};

export const TaskModelRow = ({
  task,
  label,
  help,
  preference,
  defaultProviderId,
  providerPolicy,
  connectedProviderIds,
  disabled,
  onChange,
}: Props) => {
  const limitContext = useAutoLimitContext();
  const automatic = resolveLimitedTaskModel({
    limitContext,
    task,
    preferences: null,
    workspaceDefaultProviderId: defaultProviderId,
    sessionDefaultProviderId: defaultProviderId,
    connectedProviders: connectedProviderIds,
    providerPolicy,
  });
  const resolved = resolveLimitedTaskModel({
    limitContext,
    task,
    preferences: preference === null ? null : { [task]: preference },
    workspaceDefaultProviderId: defaultProviderId,
    sessionDefaultProviderId: defaultProviderId,
    connectedProviders: connectedProviderIds,
    providerPolicy,
  });
  const skippedLine = taskSkippedLine({
    preference,
    using: resolved,
    context: {
      defaultProvider: defaultProviderId,
      connected: connectedProviderIds,
      policy: providerPolicy,
    },
  });
  const providerId = preference?.providerId ?? automatic.providerId;
  const model = preference?.model ?? '';
  const availableProviderIds = connectedProviderIds.filter(
    (candidate) => PROVIDER_CAPABILITIES[candidate].models.length > 0,
  );
  const recommendedModel = resolveLimitedTaskModel({
    limitContext: null,
    task,
    preferences: null,
    workspaceDefaultProviderId: providerId,
    sessionDefaultProviderId: defaultProviderId,
  }).model;
  const effortModel = model === '' ? recommendedModel : model;
  const effortValue = preference?.effort ?? automatic.effort ?? DEFAULT_EFFORT;
  const shownEffort =
    clampEffortForModel({ model: effortModel, effort: effortValue, provider: providerId }) ??
    effortValue;
  const hidden = useHiddenModels();
  const shownModel = preference ?? automatic;
  const isShownHidden =
    preference != null &&
    isModelHidden({
      provider: shownModel.providerId,
      hidden,
      key: resolveStoredModelSelection({ provider: shownModel.providerId, id: shownModel.model })
        .selection.key,
    });
  const hiddenNote = !isShownHidden
    ? help
    : hiddenModelNote({
        provider: shownModel.providerId,
        model: shownModel.model,
      });
  const summary = skippedLine ?? hiddenNote;
  const limitReason = autoLimitReason({
    defaultProvider: defaultProviderId,
    pickedProvider: automatic.providerId,
    atLimit: limitContext?.atLimit ?? [],
  });

  const withFallback = (next: TaskModelPreference): TaskModelPreference =>
    preference?.fallback == null ? next : { ...next, fallback: preference.fallback };

  const onFallback = (fallback: FallbackChoice | null) => {
    if (preference == null) {
      return;
    }
    const pinned: TaskModelPreference = {
      providerId: preference.providerId,
      model: preference.model,
      ...(preference.effort != null && { effort: preference.effort }),
    };
    onChange(fallback == null ? pinned : { ...pinned, fallback });
  };

  return (
    <DefaultRow
      label={label}
      summary={summary}
      isSummaryNoted={isShownHidden || skippedLine !== null}
      anchor={task}
      status={<Chip kind="state" tone="neutral" label={preference === null ? 'Auto' : 'Pinned'} />}
    >
      <RoutingPicker
        ariaLabel={`${label} routing`}
        connectedProviders={availableProviderIds}
        provider={providerId}
        model={model}
        effort={{ editable: true, value: shownEffort }}
        recommendation={{
          provider: automatic.providerId,
          model: automatic.model,
          ...(automatic.effort != null && { effort: automatic.effort }),
          ...(limitReason !== AUTO_RECOMMENDATION_COPY.reason && { reason: limitReason }),
        }}
        recommendationKind="auto"
        overridden={preference != null}
        onReset={() => onChange(null)}
        resetLabel="Back to Auto"
        align="end"
        disabled={disabled}
        onChange={(route) => {
          if (route.provider === '') {
            onChange(null);
            return;
          }
          const effort = savedRouteEffort({
            route,
            requested: effortValue,
            wasSaved: preference?.effort != null,
          });
          onChange(
            withFallback({
              providerId: route.provider,
              model: route.model,
              ...(effort != null && { effort }),
            }),
          );
        }}
        {...(preference != null && {
          footer: (
            <FallbackRow
              label={label}
              fallback={
                preference.fallback == null
                  ? null
                  : { provider: preference.fallback.providerId, model: preference.fallback.model }
              }
              auto={{ provider: automatic.providerId, model: automatic.model }}
              effort={effortValue}
              connectedProviders={availableProviderIds}
              disabled={disabled}
              onFallback={onFallback}
            />
          ),
        })}
      />
    </DefaultRow>
  );
};
