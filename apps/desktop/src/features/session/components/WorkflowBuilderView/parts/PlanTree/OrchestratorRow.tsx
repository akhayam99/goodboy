import { Chip, Eyebrow, Textarea, WORK_NODE_GLYPH_SIZE, WorkNode } from '@goodboy/ui';
import type { EffortLevel, ProviderId } from '@goodboy/types';
import { RoutingPicker } from '../../../../../../shared/components/RoutingPicker';
import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';
import { PlanTreeGutter } from './PlanTreeGutter';

type Props = {
  readonly identityIndex: number;
  readonly guidance: string;
  readonly providerOverride: ProviderId | '';
  readonly modelOverride: string;
  readonly effort: EffortLevel;
  readonly recommendedProvider: ProviderId;
  readonly recommendedModel: string;
  readonly allowedProviders: ReadonlyArray<ProviderId>;
  readonly isOverridden: boolean;
  readonly disabled: boolean;
  readonly onGuidance: (guidance: string) => void;
  readonly onProvider: (provider: ProviderId | '') => void;
  readonly onModel: (model: string) => void;
  readonly onEffort: (effort: EffortLevel) => void;
  readonly onReset: () => void;
};

const GUIDANCE_ID = 'orchestrated-workflow-guidance';

export const OrchestratorRow = ({
  identityIndex,
  guidance,
  providerOverride,
  modelOverride,
  effort,
  recommendedProvider,
  recommendedModel,
  allowedProviders,
  isOverridden,
  disabled,
  onGuidance,
  onProvider,
  onModel,
  onEffort,
  onReset,
}: Props) => (
  <section aria-label="Plan" className="flex min-w-0 flex-col gap-2">
    <div className="flex items-center justify-between gap-2">
      <Eyebrow label="Plan" muted />
      <span className="text-2xs text-faint-foreground">Steps appear as the run goes</span>
    </div>
    <ol className="flex flex-col-reverse">
      <li className="flex min-w-0 gap-1.5">
        <PlanTreeGutter
          span="none"
          identityIndex={identityIndex}
          node={
            <WorkNode
              state="marker"
              tone="primary"
              mark={{
                kind: 'glyph',
                glyph: <CONCEPT_ICONS.orchestrator size={WORK_NODE_GLYPH_SIZE} aria-hidden />,
              }}
              label="Orchestrator"
            />
          }
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex h-8 min-w-0 items-center gap-2.5 pl-2">
            <Chip tone="primary" size="3xs" width="md" shape="badge" label="Orchestrator" />
            <span className="min-w-0 flex-1 truncate text-sm leading-5 text-foreground">
              Picks each next agent
            </span>
            <RoutingPicker
              variant="pill"
              align="end"
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
          <div className="flex flex-col gap-1 pl-2">
            <label htmlFor={GUIDANCE_ID} className="text-2xs text-muted-foreground">
              Guidance (optional)
            </label>
            <Textarea
              id={GUIDANCE_ID}
              value={guidance}
              onChange={(event) => onGuidance(event.target.value)}
              placeholder="anything to respect or avoid, and when to stop (e.g. leave the payments module alone, stop once the PR is open)…"
              autoGrow
              minRows={2}
              maxRows={7}
              disabled={disabled}
              className="resize-none bg-subtle text-sm"
            />
          </div>
        </div>
      </li>
    </ol>
  </section>
);
