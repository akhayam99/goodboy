import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { LeadStepItem } from './LeadStepItem';
import { stepLinesOf } from './stepLinesOf';

type Props = {
  readonly sessionId: SessionId;
  readonly rootAgentId: AgentId;
};

export const LeadSteps = ({ sessionId, rootAgentId }: Props) => {
  const view = useAppStore((state) =>
    state.autoTreeViews[sessionId]?.find((candidate) => candidate.tree.rootAgentId === rootAgentId),
  );
  const guide = view?.guide ?? null;
  if (view === undefined || guide === null || guide.steps.length === 0) {
    return null;
  }
  const lines = stepLinesOf({ guide, delegations: view.delegations });
  return (
    <section aria-label="Usual steps" className="flex min-w-0 flex-col gap-2">
      <span className="text-eyebrow text-faint-foreground">Usual steps</span>
      <ol className="flex min-w-0 flex-wrap items-start gap-x-4 gap-y-2">
        {lines.map((line) => (
          <LeadStepItem key={line.key} line={line} />
        ))}
      </ol>
    </section>
  );
};
