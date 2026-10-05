import { ArrowUpRight, Maximize2, Minimize2 } from 'lucide-react';
import { DrawerFrame, IconButton, cn } from '@goodboy/ui';
import type { ArtifactId, SessionId } from '@goodboy/types';
import { agentPlace, sessionPlace, useAppStore } from '../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { PlanRunButton, planPartsProgress, planSplitSentence } from '../../../plans/planSurfaces';
import { planRevisingLabel } from '../../../plans/planRevising';
import { usePlanModel } from '../../../plans/usePlanModel';
import { ArtifactPlanBody } from '../ArtifactShell/ArtifactPlanBody';
import { ArtifactStateChip } from '../ArtifactShell/ArtifactStateChip';
import { ArtifactPastVersion } from './ArtifactPastVersion';

type Props = {
  readonly sessionId: SessionId;
  readonly artifactId: ArtifactId;
  readonly revision: number | null;
  readonly onClose: () => void;
};

export const ArtifactDocumentDrawer = ({ sessionId, artifactId, revision, onClose }: Props) => {
  const model = usePlanModel({ sessionId, planId: artifactId });
  const isExpanded = useAppStore((s) => s.documentDrawerExpanded[sessionId] === true);
  const setDocumentDrawerExpanded = useAppStore((s) => s.setDocumentDrawerExpanded);
  const navigate = useAppStore((s) => s.navigate);
  const openDrawer = useAppStore((s) => s.openDrawer);

  if (model === null) {
    return null;
  }
  const { plan, version, revising, state, rows, agents, hasRun } = model;
  const creator = agents.find((agent) => agent.id === plan.agentId) ?? null;
  const pastVersion = revision !== null && revision !== version ? revision : null;
  const progress = planPartsProgress({ rows, hasRun });
  const isRunning = progress.kind === 'running' || progress.kind === 'question';

  return (
    <DrawerFrame
      title={plan.title}
      icon={CONCEPT_ICONS.plans}
      iconClassName="text-muted-foreground"
      count={`v${pastVersion ?? version}`}
      closeLabel="Close the plan"
      onClose={onClose}
      action={
        <span className="flex min-w-0 items-center gap-2">
          {pastVersion === null ? (
            <>
              <ArtifactStateChip state={state} />
              {revising.kind === 'newVersion' ? (
                <span data-testid="plan-drawer-new-version" className="text-meta text-info">
                  {planRevisingLabel({ revising })}
                </span>
              ) : null}
              {isRunning ? null : <PlanRunButton sessionId={sessionId} model={model} />}
            </>
          ) : null}
          <IconButton
            icon={ArrowUpRight}
            iconSize={ICON_SIZE.row}
            label="Open in Artifacts"
            variant="ghost"
            onClick={() =>
              navigate({
                to: sessionPlace({
                  sessionId,
                  lens: 'plans',
                  target: { kind: 'artifact', artifactId: plan.id },
                }),
              })
            }
          />
          <IconButton
            icon={isExpanded ? Minimize2 : Maximize2}
            iconSize={ICON_SIZE.row}
            label={isExpanded ? 'Collapse' : 'Expand'}
            variant="ghost"
            onClick={() => setDocumentDrawerExpanded(sessionId, !isExpanded)}
          />
        </span>
      }
    >
      <div data-testid="plan-drawer" className="flex min-w-0 flex-col gap-4">
        {pastVersion === null ? (
          <div
            data-testid="plan-drawer-body"
            data-revising={revising.kind === 'revising' ? 'true' : 'false'}
            className={cn(
              'min-w-0 motion-safe:transition-opacity',
              revising.kind === 'revising' && 'pointer-events-none select-none opacity-55',
            )}
          >
            <ArtifactPlanBody
              plan={plan}
              rows={rows}
              hasRun={hasRun}
              splitSentence={planSplitSentence({
                count: rows.length,
                plannerName: creator?.name ?? null,
              })}
              onOpenPart={(row) => {
                if (hasRun && row.agentId !== null) {
                  navigate({ to: agentPlace({ sessionId, agentId: row.agentId }) });
                  return;
                }
                openDrawer({
                  kind: 'plan-part',
                  sessionId,
                  payload: { planId: plan.id, index: row.index },
                });
              }}
            />
          </div>
        ) : (
          <ArtifactPastVersion
            artifactId={plan.id}
            revision={pastVersion}
            latest={version}
            onOpenCurrent={() =>
              openDrawer({
                kind: 'artifact-document',
                sessionId,
                payload: { artifactId: plan.id, revision: null },
              })
            }
          />
        )}
      </div>
    </DrawerFrame>
  );
};
