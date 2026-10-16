import { RoutingPicker } from '../../../../../shared/components/RoutingPicker';
import { ProviderUsagePill } from '../../ProviderUsagePill';
import { PROVIDER_LABEL } from '../../../../providers/providerLabel';
import { modelLabel } from '../../../utils/chat-constants';
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
  | 'setVerbosity'
  | 'onSelectRoute'
  | 'onResetTurnOverride'
>;

type Props = {
  readonly routing: ComposerRouting;
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
      effort={{ editable: true, value: routing.effectiveEffort }}
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
      onChange={routing.onSelectRoute}
      onVerbosity={routing.setVerbosity}
      onReset={routing.onResetTurnOverride}
    />
  );
};
