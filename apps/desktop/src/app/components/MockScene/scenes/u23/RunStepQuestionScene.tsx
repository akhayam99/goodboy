import { useEffect, useState } from 'react';
import type { OpenQuestion, OpenQuestionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { WorkflowsPane } from '../../../../../features/session/components/SessionWorkspace/parts/WorkflowsPane';
import { sceneClock } from '../../sceneClock';
import { ShellFrame, seedShellChrome } from '../shellChrome';
import {
  AGENT_BACKFILL_ID,
  DYNAMIC_RUN_ID,
  FLOW_SESSION,
  FLOW_SESSION_ID,
  NOW,
  SESSIONS,
} from '../flow-audit/fixtures';
import { seedRecentBackfillOutput } from '../flow-audit/runControl';
import { seedWorkflowRun } from '../flow-audit/seeds';

const clock = sceneClock({ anchor: '2026-09-16T11:20:00.000Z' });

const BACKFILL_QUESTION: OpenQuestion = {
  id: 'mock-flow-question-backfill-window' as OpenQuestionId,
  sessionId: FLOW_SESSION_ID,
  workflowRunId: DYNAMIC_RUN_ID,
  createdByAgentId: AGENT_BACKFILL_ID,
  text: 'Should the backfill skip deliveries older than seven days?',
  suggestedAnswers: ['Skip them', 'Include them'],
  recommendedAnswer: 'Skip them',
  selectMode: 'one',
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: clock.iso({ at: '2026-09-16T11:12:00.000Z' }),
};

export const RunStepQuestionScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedWorkflowRun();
    seedRecentBackfillOutput();
    useAppStore.setState({
      sessionOpenQuestions: { [FLOW_SESSION_ID]: [BACKFILL_QUESTION] },
    });
    seedShellChrome({
      session: FLOW_SESSION,
      siblings: SESSIONS.filter((candidate) => candidate.id !== FLOW_SESSION_ID),
      branches: {},
      telemetryAt: NOW,
      lens: 'workflows',
    });
    useAppStore.setState({ currentWorkspaceId: FLOW_SESSION.workspaceId });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <ShellFrame
      session={FLOW_SESSION}
      main={
        <div className="flex h-full min-h-0 flex-col">
          <WorkflowsPane session={FLOW_SESSION} />
        </div>
      }
    />
  );
};
