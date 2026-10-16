import { useEffect, useLayoutEffect, useRef } from 'react';
import type { AgentId, SessionId, Workflow, WorkflowRun } from '@goodboy/types';
import { NextActionStrip } from '../../../workflows/components/NextActionStrip';

type Props = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly subjectAgentId: AgentId;
  readonly onShownChange?: (isShown: boolean) => void;
};

const STRIP = '[data-testid="next-action-strip"]';

export const ReportedNextActionStrip = ({
  sessionId,
  run,
  workflow,
  subjectAgentId,
  onShownChange,
}: Props) => {
  const hostRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    onShownChange?.(hostRef.current?.querySelector(STRIP) != null);
  });
  useEffect(() => () => onShownChange?.(false), [onShownChange]);
  return (
    <div ref={hostRef} className="contents">
      <NextActionStrip
        sessionId={sessionId}
        run={run}
        workflow={workflow}
        subjectAgentId={subjectAgentId}
      />
    </div>
  );
};
