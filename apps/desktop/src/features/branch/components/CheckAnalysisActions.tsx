import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, StatusDot, Tooltip } from '@goodboy/ui';
import type {
  MountId,
  PrCheckRun,
  PullRequestState,
  PullRequestView,
  SessionId,
  TurnEvent,
} from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../shared/components/conceptIcons';
import { useAppStore } from '../../../store';
import { selectCheckAnalysis } from '../../../store/slices/agents/selectCheckAnalysis';
import { isReportedError } from '../../../store/slices/notifications/reportedError';
import { modelLabel } from '../../chat/utils/chat-constants';
import { analyzeFailingChecks } from '../checks/analyzeFailingChecks';
import { checkAnalysisOf } from '../checks/checkAnalysisOf';
import { checkRoutingOf } from '../checks/checkRoutingOf';

const NO_EVENTS: ReadonlyArray<TurnEvent> = [];

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly pullRequest: PullRequestState | PullRequestView;
  readonly check: PrCheckRun;
};

export const CheckAnalysisActions = ({ sessionId, mountId, pullRequest, check }: Props) => {
  const url = check.detailsUrl ?? pullRequest.url;
  const agent = useAppStore((state) => selectCheckAnalysis({ state, sessionId, url }));
  const events = useAppStore((state) =>
    agent === null ? NO_EVENTS : (state.transcripts[agent.id] ?? NO_EVENTS),
  );
  const turnState = useAppStore((state) =>
    agent === null ? undefined : state.agentTurnState[agent.id],
  );
  const routing = useAppStore(useShallow((state) => checkRoutingOf({ state, sessionId, mountId })));
  const reportError = useAppStore((state) => state.reportError);
  const openDrawer = useAppStore((state) => state.openDrawer);
  const loadAgentTranscript = useAppStore((state) => state.loadAgentTranscript);
  const hasTranscript = useAppStore(
    (state) => agent !== null && state.transcripts[agent.id] !== undefined,
  );
  const [isStarting, setIsStarting] = useState(false);
  useEffect(() => {
    if (agent === null || hasTranscript) {
      return;
    }
    void loadAgentTranscript(sessionId, agent.id, { isSelecting: false }).catch(
      (error: unknown) => {
        if (!isReportedError(error)) {
          void reportError({ title: "Couldn't read the analysis", error, sessionId });
        }
      },
    );
  }, [agent, hasTranscript, loadAgentTranscript, reportError, sessionId]);
  const analysis = agent === null ? null : checkAnalysisOf({ agent, events, turnState });
  const start = async () => {
    if (isStarting) {
      return;
    }
    setIsStarting(true);
    try {
      await analyzeFailingChecks({ sessionId, mountId, pullRequest, checks: [check] });
    } catch (error: unknown) {
      if (!isReportedError(error)) {
        void reportError({ title: "Couldn't start the Debugger", error, sessionId });
      }
    } finally {
      setIsStarting(false);
    }
  };
  const AgentsIcon = CONCEPT_ICONS.agents;
  const canAnalyze = analysis === null || (!analysis.isRunning && analysis.proposal === null);
  return (
    <div className="flex shrink-0 items-center gap-2">
      {analysis === null ? null : (
        <>
          <StatusDot
            tone={
              analysis.isRunning ? 'warning' : analysis.proposal === null ? 'neutral' : 'success'
            }
            pulsing={analysis.isRunning}
            size="sm"
          />
          <span role="status" className="text-meta text-muted-foreground">
            {analysis.label}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              openDrawer({
                kind: 'check-analysis',
                sessionId,
                payload: { sessionId, checkUrl: url },
              })
            }
          >
            Open
          </Button>
        </>
      )}
      {canAnalyze ? (
        <Tooltip
          content={`Start a Debugger on this failure: ${modelLabel(routing.model, routing.provider)} · ${routing.effort}`}
        >
          <Button
            variant={analysis === null ? 'secondary' : 'ghost'}
            size="sm"
            disabled={isStarting}
            onClick={() => void start()}
          >
            <AgentsIcon size={ICON_SIZE.row} aria-hidden />
            {analysis === null ? 'Analyze' : 'Analyze again'}
          </Button>
        </Tooltip>
      ) : null}
    </div>
  );
};
