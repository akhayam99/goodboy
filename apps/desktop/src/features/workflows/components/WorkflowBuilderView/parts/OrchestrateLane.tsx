import { WORK_NODE_GLYPH_SIZE, WorkNode } from '@goodboy/ui';
import type { EffortLevel, ProviderId } from '@goodboy/types';
import { RoutingPicker } from '../../../../../shared/components/RoutingPicker';
import type { PickedRoute } from '../../../../../shared/components/RoutingPicker/PickedRoute';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { LaneRow } from './LaneRow';

type Props = {
  readonly identityIndex: number;
  readonly providerOverride: ProviderId | '';
  readonly modelOverride: string;
  readonly effort: EffortLevel;
  readonly recommendedProvider: ProviderId;
  readonly recommendedModel: string;
  readonly allowedProviders: ReadonlyArray<ProviderId>;
  readonly isOverridden: boolean;
  readonly isDisabled: boolean;
  readonly onRoute: (route: PickedRoute) => void;
  readonly onReset: () => void;
};

export const OrchestrateLane = ({
  identityIndex,
  providerOverride,
  modelOverride,
  effort,
  recommendedProvider,
  recommendedModel,
  allowedProviders,
  isOverridden,
  isDisabled,
  onRoute,
  onReset,
}: Props) => (
  <section aria-label="Orchestrator" className="flex min-w-0 flex-col">
    <ol className="flex flex-col">
      <LaneRow
        span="none"
        identityIndex={identityIndex}
        dataStep="orchestrator"
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
      >
        <span className="min-w-0 shrink truncate text-body text-foreground">Orchestrator</span>
        <RoutingPicker
          variant="pill"
          align="start"
          ariaLabel="Orchestrator routing"
          connectedProviders={allowedProviders}
          provider={providerOverride}
          model={modelOverride}
          effort={{ editable: true, value: effort }}
          recommendation={{ provider: recommendedProvider, model: recommendedModel }}
          recommendationKind="auto"
          disabled={isDisabled}
          overridden={isOverridden}
          onReset={onReset}
          onChange={onRoute}
        />
      </LaneRow>
    </ol>
  </section>
);
