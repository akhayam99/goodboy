import { CircleDot } from 'lucide-react';
import { Chip, tintClasses } from '@goodboy/ui';
import type { ArtifactId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS, CONCEPT_TONE, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ArtifactStateChip } from '../../../artifacts/artifactSurfaces';
import { NEW_VERSION_LABEL } from '../../planRevising';
import { usePlanModel } from '../../usePlanModel';
import { PlanRunButton } from '../PlanRunButton';
import { PlanRowFrame } from './PlanRowFrame';

const planTint = tintClasses(CONCEPT_TONE.plans);

type Props = {
  readonly sessionId: SessionId;
  readonly planId: ArtifactId;
};

export const PlanRow = ({ sessionId, planId }: Props) => {
  const model = usePlanModel({ sessionId, planId });
  const openDrawer = useAppStore((s) => s.openDrawer);
  if (model === null) {
    return null;
  }
  const { plan, version, revising, state } = model;

  return (
    <PlanRowFrame trailing={<PlanRunButton sessionId={sessionId} model={model} />}>
      <button
        type="button"
        data-testid="plan-row-open"
        aria-label={`Open plan ${plan.title}`}
        onClick={() =>
          openDrawer({
            kind: 'artifact-document',
            sessionId,
            payload: { artifactId: plan.id, revision: null },
          })
        }
        className="flex min-w-0 flex-1 items-center gap-2 rounded-sm py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        <CONCEPT_ICONS.plans size={ICON_SIZE.row} aria-hidden className={planTint.icon} />
        <span className="min-w-0 truncate text-row text-foreground">Plan · {plan.title}</span>
        <span className="shrink-0 text-meta tabular-nums text-faint-foreground">v{version}</span>
        <ArtifactStateChip state={state} />
        {revising.kind === 'newVersion' ? (
          <Chip
            tone="info"
            size="xs"
            bordered={false}
            icon={<CircleDot size={ICON_SIZE.row} aria-hidden />}
            label={NEW_VERSION_LABEL}
            className="shrink-0"
            testId="plan-row-new-version"
          />
        ) : null}
      </button>
    </PlanRowFrame>
  );
};
