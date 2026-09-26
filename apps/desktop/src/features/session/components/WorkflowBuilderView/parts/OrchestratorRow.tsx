import { Chip, Eyebrow, WORK_NODE_GLYPH_SIZE, WorkNode } from '@goodboy/ui';
import type { EffortLevel, ProviderId } from '@goodboy/types';
import { RoutingPicker } from '../../../../../shared/components/RoutingPicker';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { ExampleSteps } from './ExampleSteps';
import { GuidanceDisclosure } from './GuidanceDisclosure';
import { StepTreeGutter } from '../../../../workflows/components/StepTree/StepTreeGutter';

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
    <Eyebrow label="Plan" muted />
    <ExampleSteps identityIndex={identityIndex}>
      <li className="flex min-w-0 gap-1.5">
        <StepTreeGutter
          span="origin"
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
        <div className="flex h-8 min-w-0 flex-1 items-center gap-2.5 pl-2">
          <Chip tone="primary" size="3xs" width="md" shape="badge" label="Orchestrator" />
          <span className="min-w-0 flex-1 truncate text-body text-foreground">
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
            recommendationKind="auto"
            disabled={disabled}
            overridden={isOverridden}
            onReset={onReset}
            onProvider={onProvider}
            onModel={onModel}
          />
        </div>
      </li>
    </ExampleSteps>
    <GuidanceDisclosure
      identityIndex={identityIndex}
      guidance={guidance}
      disabled={disabled}
      onGuidance={onGuidance}
    />
  </section>
);
