import { useEffect, useState } from 'react';
import { SessionDraftPane } from '../../../../../../features/session/components/SessionDraftPane';
import { linearIssueCandidate } from '../../../../../../features/integrations/issueCandidateOf';
import type { IssueCandidate } from '../../../../../../features/integrations/fetchIssueCandidates';
import { issueBriefSources } from '../../../../../../features/session/components/SessionKickoff/issueBriefSources';
import { issueBriefKey } from '../../../../../../store/slices/issue-briefs/issueBriefKey';
import { EMPTY_SESSION_DRAFT } from '../../../../../../store/slices/sessionDraft/state';
import { useAppStore } from '../../../../../../store';
import { mockSceneIpc } from '../../mockSceneIpc';
import { WORKSPACE_ID, seedBoardScene } from '../../BoardScene';
import { StudioFrame } from '../../StudioFrame';
import { seedStudioChrome } from '../../shellChrome';
import { useSceneClicks } from '../../audit/useSceneClicks';
import { BRAND_MODELS } from '../../brand/canon';
import {
  HBL_377,
  HBL_398,
  KICKOFF_ASSIGNED,
  linearBindingOf,
  linearRecordOf,
  starredLinearOf,
} from '../../brand/kickoffIssues';

type StartManyMode = 'multiselect' | 'cap' | 'picked3' | 'crossproject';

type Props = {
  readonly mode: StartManyMode;
};

const ASSIGNED = KICKOFF_ASSIGNED.map(linearIssueCandidate);
const STARRED_377 = linearIssueCandidate(HBL_377);
const HELD_366: IssueCandidate = {
  ...linearIssueCandidate(HBL_398),
  externalId: 'mock-start-many-linear-hbl-366',
  identifier: 'HBL-366',
  title: 'Keep the settlement export in step with the ledger',
  url: 'https://linear.example.invalid/harborline/issue/HBL-366',
};

const githubIssue = ({
  number,
  repo,
  title,
}: {
  readonly number: number;
  readonly repo: string;
  readonly title: string;
}): IssueCandidate => ({
  provider: 'github',
  externalId: String(number),
  identifier: `#${number}`,
  title,
  url: `https://github.com/harborline/${repo}/issues/${number}`,
  goal: title,
  body: title,
  branchSlug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
});

const PAYMENTS_ISSUE = githubIssue({
  number: 204,
  repo: 'payments-api',
  title: 'Retried webhooks post a second credit',
});
const RELAY_ISSUE = githubIssue({
  number: 211,
  repo: 'notify-relay',
  title: 'Show the retry count on each delivery',
});

const CAP_CLICKS: ReadonlyArray<string> = ['HBL-389'];

const pickedOf = ({ mode }: Props): ReadonlyArray<IssueCandidate> => {
  switch (mode) {
    case 'multiselect':
      return ASSIGNED.slice(0, 2);
    case 'cap':
      return [...ASSIGNED.slice(0, 3), STARRED_377, HELD_366];
    case 'picked3':
      return ASSIGNED.slice(0, 3);
    case 'crossproject':
      return [PAYMENTS_ISSUE, RELAY_ISSUE];
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
};

const installIpc = (): void => {
  mockSceneIpc((cmd) => {
    if (cmd === 'linear_fetch_assigned_issues') {
      return KICKOFF_ASSIGNED;
    }
    if (cmd === 'sentry_list_code_mappings') {
      return [];
    }
    return undefined;
  });
};

const seedStartMany = ({ mode }: Props): void => {
  const picked = pickedOf({ mode });
  const isPickedStep = mode === 'picked3' || mode === 'crossproject';
  const sources = issueBriefSources({ candidates: picked });
  const first = picked[0];
  const state = useAppStore.getState();
  useAppStore.setState({
    projects: state.projects.map((project) => ({
      ...project,
      remoteUrl: `https://github.com/harborline/${project.name}.git`,
    })),
    workspaceIntegrations: { [WORKSPACE_ID]: [linearBindingOf({ workspaceId: WORKSPACE_ID })] },
    sessionExternalTasks: {},
    starredIssues: {
      [WORKSPACE_ID]: [starredLinearOf({ workspaceId: WORKSPACE_ID, issue: HBL_377 })],
    },
    starredRecords: {
      [WORKSPACE_ID]: { [`linear:${HBL_377.id}`]: linearRecordOf(HBL_377) },
    },
    loadStarredIssues: async () => undefined,
    refreshStarredIssues: async () => undefined,
    sessionDrafts: {
      [WORKSPACE_ID]: {
        ...EMPTY_SESSION_DRAFT,
        choice: 'task',
        pickedIssues: picked,
        focusedIssueKey: first === undefined ? null : `${first.provider}:${first.externalId}`,
        hasPickedStep: isPickedStep,
      },
    },
    openSessionDraftWorkspaceId: WORKSPACE_ID,
    issueBriefs: {
      [issueBriefKey({ sources })]: {
        status: 'ready',
        signature: sources.map((source) => source.identifier).join(','),
        route: { providerId: BRAND_MODELS.scout.provider, model: BRAND_MODELS.scout.model },
        brief: {
          title: 'Stop retried webhooks posting a second credit',
          goal: 'payments-api credits an account once per processor event, and the retry count shows on every notify-relay delivery.',
          acceptance: [
            'Replaying one event three times posts exactly one credit',
            'Each delivery row shows its attempt number',
          ],
        },
        durationMs: 3_800,
        costUsd: 0.004,
      },
    },
    requestIssueBrief: async () => undefined,
  });
};

export const StartManyScene = ({ mode }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    installIpc();
    seedBoardScene();
    seedStudioChrome();
    seedStartMany({ mode });
    setIsReady(true);
  }, [mode]);

  useSceneClicks({
    isReady,
    labels: mode === 'cap' ? CAP_CLICKS : [],
    selector: '[role="checkbox"]',
    match: 'contains',
    intervalMs: 300,
  });

  if (!isReady) {
    return null;
  }
  return (
    <StudioFrame
      target={{ place: null, tool: null }}
      main={<SessionDraftPane workspaceId={WORKSPACE_ID} />}
    />
  );
};
