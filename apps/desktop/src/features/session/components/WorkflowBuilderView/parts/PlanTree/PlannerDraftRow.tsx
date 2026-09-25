import { Button, Textarea, cn } from '@goodboy/ui';
import type { EffortLevel, ProviderId } from '@goodboy/types';
import { RoutingPicker } from '../../../../../../shared/components/RoutingPicker';

type Props = {
  readonly process: string;
  readonly hasPlan: boolean;
  readonly isPlanning: boolean;
  readonly disabled: boolean;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly providerOverride: ProviderId | '';
  readonly modelOverride: string;
  readonly effort: EffortLevel;
  readonly recommendedProvider: ProviderId;
  readonly recommendedModel: string;
  readonly onProcess: (process: string) => void;
  readonly onProvider: (provider: ProviderId | '') => void;
  readonly onModel: (model: string) => void;
  readonly onEffort: (effort: EffortLevel) => void;
  readonly onPlan: () => void;
};

const PROCESS_ID = 'workflow-planner-process';

export const PlannerDraftRow = ({
  process,
  hasPlan,
  isPlanning,
  disabled,
  connectedProviders,
  providerOverride,
  modelOverride,
  effort,
  recommendedProvider,
  recommendedModel,
  onProcess,
  onProvider,
  onModel,
  onEffort,
  onPlan,
}: Props) => (
  <div className="flex flex-col gap-1.5 rounded-lg bg-subtle p-2.5 ring-1 ring-border-soft focus-within:ring-foreground/15">
    <label htmlFor={PROCESS_ID} className="text-2xs text-muted-foreground">
      Describe the steps
    </label>
    <Textarea
      id={PROCESS_ID}
      value={process}
      onChange={(event) => onProcess(event.target.value)}
      placeholder="describe the process you expect (e.g. read the existing GitHub integration, study how it works, then plan the GitLab equivalent, then implement)…"
      autoGrow
      minRows={2}
      maxRows={7}
      className="min-h-12 resize-none border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
    />
    <div className="flex items-center justify-end gap-2">
      <RoutingPicker
        variant="pill"
        align="end"
        ariaLabel="Planner routing"
        connectedProviders={connectedProviders}
        provider={providerOverride}
        model={modelOverride}
        effort={{ editable: true, value: effort, onChange: onEffort }}
        recommendation={{ provider: recommendedProvider, model: recommendedModel }}
        disabled={disabled}
        onProvider={onProvider}
        onModel={onModel}
      />
      <Button
        size="sm"
        variant="secondary"
        onClick={onPlan}
        disabled={disabled || process.trim().length === 0}
        className={cn('min-w-24', isPlanning && 'animate-border-pulse')}
      >
        {isPlanning ? 'Planning…' : hasPlan ? 'Re-plan' : 'Generate plan'}
      </Button>
    </div>
  </div>
);
