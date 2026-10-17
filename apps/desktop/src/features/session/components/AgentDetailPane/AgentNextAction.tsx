import type { Agent, Session } from '@goodboy/types';
import { ReportedNextActionStrip } from './ReportedNextActionStrip';
import { useAgentNextRun } from './useAgentNextRun';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
  readonly onShownChange?: (isShown: boolean) => void;
};

export const AgentNextAction = ({ session, agent, onShownChange }: Props) => {
  const next = useAgentNextRun({ session, agent });
  if (next === null) {
    return null;
  }
  return (
    <ReportedNextActionStrip
      sessionId={session.id}
      run={next.attached.run}
      workflow={next.attached.workflow}
      subjectAgentId={next.root.id}
      {...(onShownChange !== undefined && { onShownChange })}
    />
  );
};
