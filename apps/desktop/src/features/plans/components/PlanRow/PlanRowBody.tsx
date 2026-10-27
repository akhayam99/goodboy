import { CircleDot } from 'lucide-react';
import { Chip, ICON_SIZE, tintClasses, FOCUS_RING, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { ArtifactStateChip } from '../../../artifacts/artifactSurfaces';
import { NEW_VERSION_LABEL } from '../../planRevising';
import type { PlanModel } from '../../usePlanModel';
import { usePlanPrimaryAction } from '../../usePlanPrimaryAction';
import { PlanPrimaryButton } from '../PlanPrimaryButton';
import { PlanRowFrame } from './PlanRowFrame';

const planTint = tintClasses(CONCEPT_TONE.plans);

type Props = {
  readonly sessionId: SessionId;
  readonly model: PlanModel;
};

export const PlanRowBody = ({ sessionId, model }: Props) => {
  const openDrawer = useAppStore((s) => s.openDrawer);
  const { plan, version, revising, state } = model;
  const action = usePlanPrimaryAction({ sessionId, plan, revising, isRunning: false });

  return (
    <PlanRowFrame trailing={<PlanPrimaryButton action={action} isReasonShown={false} />}>
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
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 rounded-sm py-1 text-left',
          FOCUS_RING,
        )}
      >
        <CONCEPT_ICONS.plans size={ICON_SIZE.row} aria-hidden className={planTint.icon} />
        <span className="min-w-0 truncate text-row text-foreground">Plan · {plan.title}</span>
        <span className="shrink-0 text-meta tabular-nums text-faint-foreground">v{version}</span>
        <ArtifactStateChip state={state} />
        {revising.kind === 'newVersion' ? (
          <Chip
            kind="state"
            tone="info"
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
