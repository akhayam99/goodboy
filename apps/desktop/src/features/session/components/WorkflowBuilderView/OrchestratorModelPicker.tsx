import type { ProviderId } from '@goodboy/types';
import { RoutingPicker } from '../../../../shared/components/RoutingPicker';
import type { EffortLevel } from '../../../chat/utils/chat-constants';

type Props = {
  readonly providerOverride: ProviderId | '';
  readonly modelOverride: string;
  readonly effort: EffortLevel;
  readonly recommendedProvider: ProviderId;
  readonly recommendedModel: string;
  readonly allowedProviders: ReadonlyArray<ProviderId>;
  readonly isOverridden: boolean;
  readonly disabled: boolean;
  readonly onProvider: (provider: ProviderId | '') => void;
  readonly onModel: (model: string) => void;
  readonly onEffort: (effort: EffortLevel) => void;
  readonly onReset: () => void;
};

export const OrchestratorModelPicker = ({
  providerOverride,
  modelOverride,
  effort,
  recommendedProvider,
  recommendedModel,
  allowedProviders,
  isOverridden,
  disabled,
  onProvider,
  onModel,
  onEffort,
  onReset,
}: Props) => (
  <section aria-label="Orchestrator model" className="flex flex-col gap-2">
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-foreground">Orchestrator model</span>
      <span className="text-2xs leading-relaxed text-muted-foreground">
        The model that reads your intent and decides each step. Every step it creates runs on the
        model its role gets, which you can change once the run has steps.
      </span>
    </div>
    <div className="flex justify-start">
      <div className="w-64">
        <RoutingPicker
          ariaLabel="Orchestrator routing"
          connectedProviders={allowedProviders}
          provider={providerOverride}
          model={modelOverride}
          effort={{ editable: true, value: effort, onChange: onEffort }}
          recommendation={{ provider: recommendedProvider, model: recommendedModel }}
          disabled={disabled}
          overridden={isOverridden}
          onReset={onReset}
          onProvider={onProvider}
          onModel={onModel}
        />
      </div>
    </div>
  </section>
);
