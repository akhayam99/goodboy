import { RoutingPicker } from '../../../../../shared/components/RoutingPicker';
import { ProviderUsagePill } from '../../ProviderUsagePill';
import { PROVIDER_LABEL } from '../../../../providers/providerLabel';
import { modelLabel } from '../../../utils/chat-constants';
import type { useTurnRouting } from '../hooks/useTurnRouting';

type Props = {
  readonly routing: ReturnType<typeof useTurnRouting>;
};

export const ComposerRoutingPicker = ({ routing }: Props) => {
  const overrideDisabledTitle = !routing.allowOverride
    ? 'this session was created without per-turn routing overrides'
    : undefined;

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
