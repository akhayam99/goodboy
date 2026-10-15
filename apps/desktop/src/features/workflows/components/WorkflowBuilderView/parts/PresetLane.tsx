import { Fragment } from 'react';
import { Eyebrow, Tooltip, WorkMeta, WorkNode } from '@goodboy/ui';
import type { EffortLevel, ProviderId, WorkflowAutonomy } from '@goodboy/types';
import type { StepDraft } from '../../../engine';
import { AgentKindChip } from '../../../../../shared/components/AgentKindChip';
import type { PickedRoute } from '../../../../../shared/components/RoutingPicker/PickedRoute';
import { ROLE_LABEL, type AgentKind } from '../../../../session/agent-kind';
import { StepModelFields } from '../../StepTree/StepModelFields';
import type { PlanStepEstimate, PlanTotal } from '../planEstimates';
import { pausePointsOf } from '../pausePoints';
import { LaneRow } from './LaneRow';
import { PauseRow } from './PauseRow';
import { StepModelChip } from './StepModelChip';

export type PresetLaneRow = {
  readonly step: StepDraft;
  readonly kind: AgentKind;
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: EffortLevel;
  readonly recommendedProvider: ProviderId;
  readonly recommendedModel: string;
  readonly isPinned: boolean;
  readonly isEdited: boolean;
  readonly estimate: PlanStepEstimate | null;
};

type Props = {
  readonly rows: ReadonlyArray<PresetLaneRow>;
  readonly identityIndex: number;
  readonly autonomy: WorkflowAutonomy;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly total: PlanTotal | null;
  readonly isDisabled: boolean;
  readonly onRoute: (key: string, route: PickedRoute) => void;
  readonly onFollowRole: (key: string) => void;
  readonly onPin: (key: string) => void;
};

export const PresetLane = ({
  rows,
  identityIndex,
  autonomy,
  connectedProviders,
  total,
  isDisabled,
  onRoute,
  onFollowRole,
  onPin,
}: Props) => {
  const pauses = pausePointsOf({ autonomy, kinds: rows.map((row) => row.kind) });
  return (
    <section aria-label="Steps" className="flex min-w-0 flex-col">
      <ol className="flex flex-col">
        {rows.map((row, index) => {
          const { step } = row;
          const name = step.name.trim() === '' ? ROLE_LABEL[step.role] : step.name.trim();
          return (
            <Fragment key={step.key}>
              <LaneRow
                span={index === rows.length - 1 ? 'tip' : index === 0 ? 'origin' : 'through'}
                identityIndex={identityIndex}
                dataStep={step.key}
                node={
                  <WorkNode
                    state="queued"
                    mark={{ kind: 'glyph', glyph: null }}
                    label={`Step ${index + 1}, not started`}
                  />
                }
                trailing={
                  <WorkMeta
                    isPlanned
                    isCostRange={false}
                    routing={
                      <span
                        data-meta-column="model"
                        className="flex w-52 min-w-0 shrink-0 justify-start @max-[640px]:w-auto"
                      >
                        <StepModelChip
                          stepLabel={name}
                          provider={row.provider}
                          model={row.model}
                          effort={row.effort}
                          isPinned={row.isPinned}
                          isDisabled={isDisabled}
                        >
                          <StepModelFields
                            step={step}
                            routingLabel={`Model for ${name}`}
                            effort={row.effort}
                            recommendedProvider={row.recommendedProvider}
                            recommendedModel={row.recommendedModel}
                            connectedProviders={connectedProviders}
                            isRoutingOverridden={row.isPinned}
                            isDisabled={isDisabled}
                            onRoute={(route) => onRoute(step.key, route)}
                            onRoutingReset={() => onFollowRole(step.key)}
                            onPin={() => onPin(step.key)}
                          />
                        </StepModelChip>
                      </span>
                    }
                    time={
                      row.estimate?.time == null ? undefined : (
                        <Tooltip content={row.estimate.time.detail}>
                          <span data-testid="work-time">{row.estimate.time.label}</span>
                        </Tooltip>
                      )
                    }
                  />
                }
              >
                <AgentKindChip kind={row.kind} density="glyph" isDecorative />
                <span className="min-w-0 truncate text-body text-foreground">{name}</span>
                {row.isEdited ? (
                  <span className="inline-flex shrink-0 items-center">
                    <span aria-hidden className="size-1.5 rounded-full bg-warning" />
                    <span className="sr-only">Edited</span>
                  </span>
                ) : null}
                <span aria-hidden className="min-w-0 flex-1" />
              </LaneRow>
              {pauses
                .filter((pause) => pause.afterIndex === index)
                .map((pause) => (
                  <PauseRow key={pause.text} identityIndex={identityIndex} text={pause.text} />
                ))}
            </Fragment>
          );
        })}
      </ol>
      {total === null ? null : (
        <div className="flex min-w-0 gap-2" data-testid="plan-estimate">
          <span aria-hidden className="w-5 shrink-0" />
          <div className="flex h-8 min-w-0 flex-1 items-center justify-between gap-3 pl-2">
            <Eyebrow label="Estimate" muted />
            <span className="text-meta tabular-nums text-muted-foreground">{total.label}</span>
          </div>
        </div>
      )}
    </section>
  );
};
