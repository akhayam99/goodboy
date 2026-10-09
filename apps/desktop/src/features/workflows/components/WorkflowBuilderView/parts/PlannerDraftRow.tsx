import { Button, cn } from '@goodboy/ui';
import { PromptField } from '../../../../../shared/components/PromptField';
import type { EffortLevel, ProviderId } from '@goodboy/types';
import { RoutingPicker } from '../../../../../shared/components/RoutingPicker';
import type { PickedRoute } from '../../../../../shared/components/RoutingPicker/PickedRoute';

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
  readonly onRoute: (route: PickedRoute) => void;
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
  onRoute,
  onPlan,
}: Props) => (
  <div className="flex flex-col gap-2 rounded-lg bg-subtle p-3 ring-1 ring-border-soft focus-within:ring-foreground/15">
    <label htmlFor={PROCESS_ID} className="text-meta text-muted-foreground">
      Describe the steps
    </label>
    <PromptField
      variant="bare"
      kind="document"
      label="Describe the steps"
      id={PROCESS_ID}
      value={process}
      onChange={onProcess}
      onSubmit={onPlan}
      isSubmitBlocked={disabled || isPlanning || process.trim() === ''}
      placeholder="describe the process you expect (e.g. read the existing GitHub integration, study how it works, then plan the GitLab equivalent, then implement)…"
      minRows={2}
      maxRows={7}
      textClassName="min-h-12 px-0 py-0"
    />
    <div className="flex items-center justify-end gap-2">
      <RoutingPicker
        variant="pill"
        align="end"
        ariaLabel="Planner routing"
        connectedProviders={connectedProviders}
        provider={providerOverride}
        model={modelOverride}
        effort={{ editable: true, value: effort }}
        recommendation={{ provider: recommendedProvider, model: recommendedModel }}
        recommendationKind="auto"
        overridden={providerOverride !== '' || modelOverride !== ''}
        disabled={disabled}
        onChange={onRoute}
      />
      <Button
        size="sm"
        variant="secondary"
        onClick={onPlan}
        disabled={disabled || process.trim().length === 0}
        className="min-w-24"
      >
        <span className={cn(isPlanning && 'text-shimmer')}>
          {isPlanning ? 'Planning…' : hasPlan ? 'Re-plan' : 'Generate plan'}
        </span>
      </Button>
    </div>
  </div>
);
