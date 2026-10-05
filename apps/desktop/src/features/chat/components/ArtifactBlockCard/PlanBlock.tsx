import { CircleDot } from 'lucide-react';
import { cn, tintClasses } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { CONCEPT_ICONS, CONCEPT_TONE, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import {
  resolveArtifactForBlock,
  resolveReplacedPlan,
} from '../../../artifacts/resolveArtifactForBlock';
import { PlanRow, PlanRowFrame } from '../../../plans/planSurfaces';
import type { TranscriptItem } from '../../utils/transcript-items';

const planTint = tintClasses(CONCEPT_TONE.plans);

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'artifact_block' }>;
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
  readonly planVersion: number | null;
};

export const PlanBlock = ({ item, sessionId, agentId, planVersion }: Props) => {
  const artifacts = useAppStore((s) => s.sessionArtifacts[sessionId] ?? EMPTY_ARRAY);
  const openDrawer = useAppStore((s) => s.openDrawer);

  if (!item.complete) {
    return (
      <PlanRowFrame testId="plan-block-arriving">
        <span className="flex min-w-0 flex-1 items-center gap-2 py-1 text-muted-foreground">
          <CircleDot
            size={ICON_SIZE.row}
            aria-hidden
            className={cn('shrink-0 motion-safe:animate-soft-pulse', planTint.icon)}
          />
          <span className="min-w-0 truncate">
            Plan · {item.title === null ? 'writing' : item.title}
          </span>
        </span>
      </PlanRowFrame>
    );
  }

  const resolved = resolveArtifactForBlock({
    artifacts,
    agentId,
    runId: item.runId,
    artifactKind: item.artifactKind,
  });
  if (resolved !== null) {
    return <PlanRow sessionId={sessionId} planId={resolved.id} />;
  }

  const replaced = resolveReplacedPlan({
    artifacts,
    agentId,
    ordinal: planVersion,
    title: item.title,
  });
  if (replaced !== null) {
    return (
      <button
        type="button"
        data-testid="plan-block-replaced"
        onClick={() =>
          openDrawer({
            kind: 'artifact-document',
            sessionId,
            payload: { artifactId: replaced.artifact.id, revision: replaced.version },
          })
        }
        className="-ml-2 flex min-h-7 w-[calc(100%+0.5rem)] min-w-0 items-center gap-2 rounded-md px-2 text-left text-label text-muted-foreground transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        <CONCEPT_ICONS.plans size={ICON_SIZE.row} aria-hidden className="shrink-0" />
        <span className="min-w-0 truncate">
          Plan v{replaced.version} · replaced by v{replaced.latest}
        </span>
      </button>
    );
  }

  return (
    <PlanRowFrame testId="artifact-block-row">
      <span className="flex min-w-0 flex-1 items-center gap-2 py-1 text-muted-foreground">
        <CONCEPT_ICONS.plans size={ICON_SIZE.row} aria-hidden className="shrink-0" />
        <span className="shrink-0">Plan not in this session</span>
        {item.title === null ? null : (
          <span className="min-w-0 truncate text-row text-foreground">{item.title}</span>
        )}
      </span>
    </PlanRowFrame>
  );
};
