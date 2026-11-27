import { useEffect, useState } from 'react';
import {
  brandId,
  type Agent,
  type IsoDateTime,
  type ProviderRunId,
  type TurnEvent,
  type TurnState,
} from '@goodboy/types';
import { SessionOverviewPane } from '../../../../features/session/components/SessionOverviewPane';
import { useAppStore } from '../../../../store';
import { ACTIVITY_QUESTION_SESSION, seedActivityQuestionScene } from './activityQuestionSeed';
import { ShellFrame, seedShellChrome } from './shellChrome';

const SESSION_ID = ACTIVITY_QUESTION_SESSION.id;
const ASKED = brandId<IsoDateTime>({ value: '2026-09-28T10:03:00.000Z' });
const RUN_ID = brandId<ProviderRunId>({ value: 'mock-permission-run-ledger-core' });

const BLOCKED: TurnState = { kind: 'blocked', runId: RUN_ID, blockedAt: ASKED };

const REQUEST: TurnEvent = {
  kind: 'permission_request',
  runId: RUN_ID,
  toolUseId: 'mock-permission-tool-ledger-core',
  toolName: 'Bash',
  input: { command: 'pnpm test in ledger-core' },
  at: ASKED,
};

const seedLeadPermissionScene = (): void => {
  seedActivityQuestionScene();
  const state = useAppStore.getState();
  const [lead] = state.sessionPhaseRuns[SESSION_ID] ?? [];
  if (lead === undefined) {
    return;
  }
  const waiting: Agent = { ...lead, status: 'running' };
  useAppStore.setState({
    sessionPhaseRuns: { [SESSION_ID]: [waiting] },
    sessionOpenQuestions: { [SESSION_ID]: [] },
    agentKindOverride: { ...state.agentKindOverride, [waiting.id]: 'auto' },
    transcripts: { ...state.transcripts, [waiting.id]: [REQUEST] },
    agentTurnState: { ...state.agentTurnState, [waiting.id]: BLOCKED },
  });
};

export const LeadPermissionScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedLeadPermissionScene();
    seedShellChrome({
      session: ACTIVITY_QUESTION_SESSION,
      siblings: [],
      branches: { [SESSION_ID]: 'nw/fix-settlement-rounding' },
      telemetryAt: ASKED,
      lens: null,
    });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <ShellFrame
      session={ACTIVITY_QUESTION_SESSION}
      main={<SessionOverviewPane session={ACTIVITY_QUESTION_SESSION} />}
    />
  );
};
