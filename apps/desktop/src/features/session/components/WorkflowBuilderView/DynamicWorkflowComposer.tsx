import { Divider, Input, Textarea } from '@goodboy/ui';
import type { ProviderId, EffortLevel } from '@goodboy/types';
import { OrchestratorModelPicker } from './OrchestratorModelPicker';

type Props = {
  readonly name: string;
  readonly namePlaceholder: string;
  readonly process: string;
  readonly orchestratorProviderOverride: ProviderId | '';
  readonly orchestratorModelOverride: string;
  readonly orchestratorEffort: EffortLevel;
  readonly recommendedOrchestratorProvider: ProviderId;
  readonly recommendedOrchestratorModel: string;
  readonly orchestratorProviders: ReadonlyArray<ProviderId>;
  readonly isOrchestratorOverridden: boolean;
  readonly disabled: boolean;
  readonly onName: (name: string) => void;
  readonly onProcess: (process: string) => void;
  readonly onOrchestratorProvider: (provider: ProviderId | '') => void;
  readonly onOrchestratorModel: (model: string) => void;
  readonly onOrchestratorEffort: (effort: EffortLevel) => void;
  readonly onOrchestratorReset: () => void;
};

export const DynamicWorkflowComposer = ({
  name,
  namePlaceholder,
  process,
  orchestratorProviderOverride,
  orchestratorModelOverride,
  orchestratorEffort,
  recommendedOrchestratorProvider,
  recommendedOrchestratorModel,
  orchestratorProviders,
  isOrchestratorOverridden,
  disabled,
  onName,
  onProcess,
  onOrchestratorProvider,
  onOrchestratorModel,
  onOrchestratorEffort,
  onOrchestratorReset,
}: Props) => (
  <div className="overflow-hidden rounded-lg border border-border-soft bg-subtle">
    <div className="flex flex-col gap-1 p-3">
      <label
        htmlFor="orchestrated-workflow-name"
        className="text-2xs font-medium text-muted-foreground"
      >
        Workflow name
      </label>
      <Input
        id="orchestrated-workflow-name"
        value={name}
        placeholder={namePlaceholder}
        onChange={(event) => onName(event.target.value)}
        disabled={disabled}
        className="h-8 bg-background text-sm font-medium"
      />
    </div>
    <Divider />
    <div className="flex flex-col gap-1 p-3">
      <label
        htmlFor="orchestrated-workflow-guidance"
        className="text-2xs font-medium text-muted-foreground"
      >
        Guidance (optional)
      </label>
      <Textarea
        id="orchestrated-workflow-guidance"
        value={process}
        onChange={(event) => onProcess(event.target.value)}
        placeholder="anything to respect or avoid, and when to stop (e.g. leave the payments module alone, stop once the PR is open)…"
        autoGrow
        minRows={3}
        maxRows={7}
        disabled={disabled}
        className="resize-none bg-background text-sm"
      />
    </div>
    <Divider />
    <div className="p-3">
      <OrchestratorModelPicker
        providerOverride={orchestratorProviderOverride}
        modelOverride={orchestratorModelOverride}
        effort={orchestratorEffort}
        recommendedProvider={recommendedOrchestratorProvider}
        recommendedModel={recommendedOrchestratorModel}
        allowedProviders={orchestratorProviders}
        isOverridden={isOrchestratorOverridden}
        disabled={disabled}
        onProvider={onOrchestratorProvider}
        onModel={onOrchestratorModel}
        onEffort={onOrchestratorEffort}
        onReset={onOrchestratorReset}
      />
    </div>
  </div>
);
