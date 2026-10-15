import { Fragment } from 'react';
import { WORK_NODE_GLYPH_SIZE, WorkNode } from '@goodboy/ui';
import type { EffortLevel, ProviderId, WorkflowAutonomy } from '@goodboy/types';
import { RoutingPicker } from '../../../../../shared/components/RoutingPicker';
import type { PickedRoute } from '../../../../../shared/components/RoutingPicker/PickedRoute';
import { AgentKindChip } from '../../../../../shared/components/AgentKindChip';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { KIND_TO_ROLE, ROLE_LABEL, type AgentKind } from '../../../../session/agent-kind';
import { pausePointsOf } from '../pausePoints';
import { LaneRow } from './LaneRow';
import { PauseRow } from './PauseRow';

type Props = {
  readonly identityIndex: number;
  readonly autonomy: WorkflowAutonomy;
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

const LIKELY_KINDS: ReadonlyArray<AgentKind> = ['scout', 'planner', 'implementer'];

export const OrchestrateLane = ({
  identityIndex,
  autonomy,
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
}: Props) => {
  const pauses = pausePointsOf({ autonomy, kinds: LIKELY_KINDS });
  return (
    <section aria-label="Plan" className="flex min-w-0 flex-col">
      <ol className="flex flex-col">
        <LaneRow
          span="origin"
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
          trailing={
            <RoutingPicker
              variant="pill"
              align="end"
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
          }
        >
          <span className="min-w-0 flex-1 truncate text-body text-foreground">Orchestrator</span>
        </LaneRow>
        <LaneRow span="through" identityIndex={identityIndex}>
          <span className="shrink-0 text-label text-muted-foreground">Likely steps</span>
          <span aria-hidden className="h-px min-w-0 flex-1 bg-border-soft" />
        </LaneRow>
        {LIKELY_KINDS.map((kind, index) => (
          <Fragment key={kind}>
            <LaneRow
              span={index === LIKELY_KINDS.length - 1 ? 'tip' : 'through'}
              identityIndex={identityIndex}
              dataStep={kind}
              node={
                <WorkNode
                  state="queued"
                  mark={{ kind: 'glyph', glyph: null }}
                  label={`Likely step ${index + 1}, ${ROLE_LABEL[KIND_TO_ROLE[kind]]}`}
                />
              }
            >
              <AgentKindChip kind={kind} density="glyph" isDecorative />
              <span className="min-w-0 truncate text-body text-foreground">
                {ROLE_LABEL[KIND_TO_ROLE[kind]]}
              </span>
            </LaneRow>
            {pauses
              .filter((pause) => pause.afterIndex === index)
              .map((pause) => (
                <PauseRow key={pause.text} identityIndex={identityIndex} text={pause.text} />
              ))}
          </Fragment>
        ))}
      </ol>
    </section>
  );
};
