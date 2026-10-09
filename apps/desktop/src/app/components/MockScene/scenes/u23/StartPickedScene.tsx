import { useEffect, useState } from 'react';
import { useAppStore } from '../../../../../store';
import type { IssueBriefEntry } from '../../../../../store/slices/issue-briefs/types';
import { NewSessionBridge } from '../../../../../features/session/components/NewSessionBridge';
import type { IssueCandidate } from '../../../../../features/integrations/fetchIssueCandidates';
import { SESSION, WORKSPACE_ID } from '../workflowSeed';
import { seedSessionStart } from '../audit/SessionStartScene';
import { SessionStartMain } from '../audit/SessionStartMain';
import { WorkspaceFrame } from '../audit/WorkspaceFrame';

const START_CANDIDATE: IssueCandidate = {
  provider: 'linear',
  externalId: 'hbl-412',
  identifier: 'HBL-412',
  title: 'Retried webhooks post a second credit',
  url: 'https://linear.app/harborline/issue/HBL-412',
  goal: '[HBL-412] Retried webhooks post a second credit\n\nWhen the processor redelivers an event, payments-api credits the account again.',
  body: 'When the processor redelivers an event, payments-api credits the account again.',
  branchSlug: 'retried-webhooks-post-a-second-credit',
};

const START_BRIEF: IssueBriefEntry = {
  status: 'ready',
  signature: 'start-pick-one-block',
  route: { providerId: 'anthropic', model: 'haiku-4.5' },
  brief: {
    title: 'Stop retried webhooks posting a second credit',
    goal: 'payments-api credits an account once per processor event, and ledger-core shows one posting per event id.',
    acceptance: [
      'Replaying one event three times posts exactly one credit',
      'ledger-core shows one posting per event id',
    ],
  },
  durationMs: 4_000,
  costUsd: 0,
};

export const StartPickedScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedSessionStart({
      choice: 'task',
      issueKey: `${START_CANDIDATE.provider}:${START_CANDIDATE.externalId}`,
      pickedIssue: START_CANDIDATE,
    });
    useAppStore.setState((state) => ({
      issueBriefs: {
        ...state.issueBriefs,
        [`${START_CANDIDATE.provider}:${START_CANDIDATE.externalId}`]: START_BRIEF,
      },
      currentSessionId: null,
      openSessionDraftWorkspaceId: WORKSPACE_ID,
    }));
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }
  return (
    <>
      <NewSessionBridge />
      <WorkspaceFrame session={SESSION} main={<SessionStartMain />} />
    </>
  );
};
