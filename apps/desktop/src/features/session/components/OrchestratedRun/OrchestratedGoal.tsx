import { useState } from 'react';
import { ClampedProse, EmptyLine, Markdown, FOCUS_RING, cn } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { GoalAttachmentsStrip } from '../../../context/components/ContextPanel/strips/GoalAttachmentsStrip';
import { ORCHESTRATED_COPY } from '../../../workflows/orchestratedCopy';
import { orchestratorProcessText } from '../../../../store/slices/workflows/standingGuidance';
import type { RunView } from '../AgentTree/useRunView';
import { OrchestratedFacts } from './OrchestratedFacts';

type Props = {
  readonly session: Session;
  readonly view: RunView;
};

const QUIET_TOGGLE = cn(
  'inline-flex h-6 items-center self-start rounded-md text-ui text-muted-foreground hover:bg-hover hover:text-foreground',
  FOCUS_RING,
);

export const OrchestratedGoal = ({ session, view }: Props) => {
  const { run, workflow } = view;
  const [isGuidanceShown, setIsGuidanceShown] = useState(false);
  const goal = (run.goal ?? workflow.goal ?? '').trim();
  const guidance = orchestratorProcessText({ processText: workflow.processText, run });

  return (
    <section aria-label="Goal" className="flex min-w-0 flex-col gap-2">
      {goal === '' ? (
        <EmptyLine className="text-read text-faint-foreground">
          No goal was set for this run.
        </EmptyLine>
      ) : (
        <ClampedProse text={goal} lines={4} className="text-read text-foreground" />
      )}
      <OrchestratedFacts session={session} view={view} />
      {guidance !== '' ? (
        <button
          type="button"
          className={QUIET_TOGGLE}
          aria-expanded={isGuidanceShown}
          onClick={() => setIsGuidanceShown((isShown) => !isShown)}
        >
          {isGuidanceShown ? ORCHESTRATED_COPY.hideGuidance : ORCHESTRATED_COPY.showGuidance}
        </button>
      ) : null}
      {isGuidanceShown && guidance !== '' ? (
        <Markdown text={guidance} className="text-ui text-muted-foreground" />
      ) : null}
      <GoalAttachmentsStrip owner={{ type: 'workflow_run', id: run.id }} />
    </section>
  );
};
