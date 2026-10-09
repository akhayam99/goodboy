import type { ProviderId } from '@goodboy/types';
import { canonicalModelId } from '@goodboy/core';
import { RoutingPicker } from '../../../../../shared/components/RoutingPicker';
import { ProviderUsagePill } from '../../ProviderUsagePill';
import { PROVIDER_LABEL } from '../../../../providers/providerLabel';
import { modelLabel } from '../../../utils/chat-constants';
import type { AgentHeaderRouting } from '../../../../../shared/hooks/useAgentHeaderRouting/agentHeaderRouting';
import type { useTurnRouting } from '../hooks/useTurnRouting';

type FullRouting = ReturnType<typeof useTurnRouting>;

export type ComposerRouting = Pick<
  FullRouting,
  | 'effectiveProvider'
  | 'effectiveModelId'
  | 'effectiveEffort'
  | 'verbosity'
  | 'connectedProviderIds'
  | 'allowOverride'
  | 'isOverridden'
  | 'referenceProvider'
  | 'referenceModel'
  | 'setEffort'
  | 'setVerbosity'
  | 'onSelectProvider'
  | 'onSelectModel'
  | 'onResetTurnOverride'
>;

type Props = {
  readonly routing: ComposerRouting;
  readonly header: AgentHeaderRouting | null;
};

type SameModelParams = {
  readonly header: AgentHeaderRouting;
  readonly routing: ComposerRouting;
};

const isHeaderModel = ({ header, routing }: SameModelParams): boolean => {
  if (header.provider === null || header.model === null) {
    return false;
  }
  const provider = header.provider as ProviderId;
  return (
    provider === routing.effectiveProvider &&
    canonicalModelId({ provider, modelId: header.model }) ===
      canonicalModelId({ provider: routing.effectiveProvider, modelId: routing.effectiveModelId })
  );
};

export const ComposerRoutingPickerView = ({ routing, header }: Props) => {
  const overrideDisabledTitle = !routing.allowOverride
    ? 'this session was created without per-turn routing overrides'
    : undefined;
  const isRedundant = header !== null && isHeaderModel({ header, routing });

  return (
    <RoutingPicker
      variant="pill"
      align="end"
      ariaLabel="Model routing"
      openEvent="goodboy:open-model-picker"
      shortcut="session.model"
      provider={routing.effectiveProvider}
      model={routing.effectiveModelId}
      effort={{
        editable: true,
        value: routing.effectiveEffort,
        onChange: routing.setEffort,
      }}
      verbosity={routing.verbosity}
      connectedProviders={routing.connectedProviderIds}
      disabled={!routing.allowOverride}
      disabledTitle={overrideDisabledTitle}
      overridden={routing.isOverridden}
      defaultSummary={`${PROVIDER_LABEL[routing.referenceProvider]} · ${modelLabel(
        routing.referenceModel,
        routing.referenceProvider,
      )}`}
      budget={<ProviderUsagePill provider={routing.effectiveProvider} />}
      {...(isRedundant ? { quietLabel: 'Model' } : {})}
      {...(header !== null && !isRedundant ? { triggerPrefix: 'Next turn' } : {})}
      onProvider={(next) => {
        if (next === '') {
          return;
        }
        routing.onSelectProvider(next);
      }}
      onModel={routing.onSelectModel}
      onVerbosity={routing.setVerbosity}
      onReset={routing.onResetTurnOverride}
    />
  );
};
