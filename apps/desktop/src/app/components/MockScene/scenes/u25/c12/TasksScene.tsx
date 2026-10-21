import { useCallback, useEffect } from 'react';
import { InboxLookupGroup } from '../../../../../../features/inbox/components/InboxStudio/InboxLookupGroup';
import { linearIssueCandidate } from '../../../../../../features/integrations/issueCandidateOf';
import type { WorkspaceIssueLookup } from '../../../../../../features/integrations/hooks/useWorkspaceIssueLookup';
import type { LinearIssueComment } from '../../../../../../features/integrations/linear/client';
import type { InboxRecord } from '../../../../../../features/inbox/types';
import { mockSceneIpc } from '../../mockSceneIpc';
import { IssueScenePane } from './IssueScenePane';
import { TasksStage } from './TasksStage';
import { LEDGER_ISSUE, LEDGER_RECORD, WORKSPACE_TASKS } from './tasksSeed';

type TasksSceneState =
  | 'forme'
  | 'all'
  | 'expanded'
  | 'lookup'
  | 'ratelimited'
  | 'filter'
  | 'issue-pane'
  | 'issue-github'
  | 'issue-edit'
  | 'issue-sentry'
  | 'issue-full';

const noop = () => undefined;

const OPEN_MENU_DELAY_MS = 50;

const COMMENTS: ReadonlyArray<LinearIssueComment> = [
  {
    id: 'hbl-412-c1',
    body: 'Reproduced with the March ledger: 14,210 rows, the request dies at 30 seconds.',
    createdAt: '2026-10-15T08:10:00Z',
    parent: null,
    user: { name: 'Cascadia Dev', avatarUrl: null },
  },
  {
    id: 'hbl-412-c2',
    body: 'Streaming works locally. #418 keeps memory flat at 40 MB.',
    createdAt: '2026-10-15T15:40:00Z',
    parent: { id: 'hbl-412-c1' },
    user: { name: 'Acme Ops', avatarUrl: null },
  },
  {
    id: 'hbl-412-c3',
    body: 'Finance checked the header order on the staging export. Good to ship.',
    createdAt: '2026-10-16T07:55:00Z',
    parent: null,
    user: { name: 'Harborline Ops', avatarUrl: null },
  },
];

const installIpc = (): void => {
  mockSceneIpc((command) => {
    if (command === 'linear_fetch_issue_comments') {
      return COMMENTS;
    }
    if (command.includes('comments')) {
      return [];
    }
    return null;
  });
};

const LOOKUP_CODE = 'HBL-9001';

const LOOKUP_ISSUE = {
  ...LEDGER_ISSUE,
  id: 'mock-c12-linear-9001',
  identifier: LOOKUP_CODE,
  title: 'Ledger import skips rows with a trailing comma',
  url: 'https://example.invalid/linear/HBL-9001',
  state: { name: 'Todo', type: 'unstarted' },
  attachments: { nodes: [] },
};

const LOOKUP_RECORD: InboxRecord = {
  ...LEDGER_RECORD,
  key: `linear:issue:${LOOKUP_ISSUE.id}`,
  identifier: LOOKUP_CODE,
  title: LOOKUP_ISSUE.title,
  state: 'open',
  stateLabel: 'Todo',
  url: LOOKUP_ISSUE.url,
  payload: { provider: 'linear', kind: 'issue', issue: LOOKUP_ISSUE, sessionId: null },
};

const LOOKUP: WorkspaceIssueLookup = {
  code: LOOKUP_CODE,
  settled: null,
  state: {
    status: 'done',
    key: `${LOOKUP_CODE}#0`,
    value: {
      route: {
        kind: 'lookup',
        label: LOOKUP_CODE,
        targets: [{ provider: 'linear', identifier: LOOKUP_CODE }],
      },
      result: {
        hits: [
          {
            target: { provider: 'linear', identifier: LOOKUP_CODE },
            candidate: linearIssueCandidate(LOOKUP_ISSUE),
            record: LOOKUP_RECORD,
          },
        ],
        misses: [],
      },
    },
  },
  loadingProviders: [],
  retryAt: null,
  retry: noop,
};

type FirstOfParams = {
  readonly provider: InboxRecord['provider'];
};

const firstOf = ({ provider }: FirstOfParams): InboxRecord =>
  WORKSPACE_TASKS.find((record) => record.provider === provider) ?? LEDGER_RECORD;

const LINEAR_AT_41 = WORKSPACE_TASKS.filter((record) => record.provider === 'linear')[40];

type Props = {
  readonly state: TasksSceneState;
};

export const TasksScene = ({ state }: Props) => {
  const seed = useCallback(() => installIpc(), []);

  useEffect(() => {
    if (state !== 'filter') {
      return;
    }
    const timer = window.setTimeout(() => {
      document.querySelector<HTMLButtonElement>('[data-filter-button]')?.click();
    }, OPEN_MENU_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [state]);

  const starredKeys = [LEDGER_RECORD.key];

  switch (state) {
    case 'forme':
    case 'filter':
      return (
        <TasksStage
          records={WORKSPACE_TASKS}
          scope="for-me"
          groupBy="source"
          starredKeys={starredKeys}
          cursorKey={LEDGER_RECORD.key}
          onSeed={seed}
        />
      );
    case 'all':
      return (
        <TasksStage
          records={WORKSPACE_TASKS}
          scope="all"
          groupBy="source"
          starredKeys={starredKeys}
          onSeed={seed}
        />
      );
    case 'expanded':
      return (
        <TasksStage
          records={WORKSPACE_TASKS}
          scope="all"
          groupBy="source"
          expandedKey="source:linear"
          cursorKey={LINEAR_AT_41?.key ?? null}
          onSeed={seed}
        />
      );
    case 'lookup':
      return (
        <TasksStage
          records={WORKSPACE_TASKS}
          scope="for-me"
          groupBy="source"
          query={LOOKUP_CODE}
          lookup={
            <InboxLookupGroup
              lookup={LOOKUP}
              workspaceName="Harborline"
              selectedKey={null}
              cursorKey={LOOKUP_RECORD.key}
              onSelect={noop}
            />
          }
          onSeed={seed}
        />
      );
    case 'ratelimited':
      return (
        <TasksStage
          records={WORKSPACE_TASKS}
          scope="all"
          groupBy="source"
          failures={{ linear: 'Linear answered 429: rate limited' }}
          onSeed={seed}
        />
      );
    case 'issue-pane':
    case 'issue-edit':
      return (
        <TasksStage
          records={WORKSPACE_TASKS}
          scope="for-me"
          groupBy="source"
          starredKeys={starredKeys}
          selectedKey={LEDGER_RECORD.key}
          cursorKey={LEDGER_RECORD.key}
          drawer={<IssueScenePane record={LEDGER_RECORD} isEditing={state === 'issue-edit'} />}
          onSeed={seed}
        />
      );
    case 'issue-github': {
      const github = firstOf({ provider: 'github' });
      return (
        <TasksStage
          records={WORKSPACE_TASKS}
          scope="for-me"
          groupBy="source"
          selectedKey={github.key}
          cursorKey={github.key}
          drawer={<IssueScenePane record={github} />}
          onSeed={seed}
        />
      );
    }
    case 'issue-sentry': {
      const sentry = firstOf({ provider: 'sentry' });
      return (
        <TasksStage
          records={WORKSPACE_TASKS}
          scope="all"
          groupBy="source"
          selectedKey={sentry.key}
          cursorKey={sentry.key}
          drawer={<IssueScenePane record={sentry} />}
          onSeed={seed}
        />
      );
    }
    case 'issue-full':
      return (
        <TasksStage
          records={WORKSPACE_TASKS}
          scope="for-me"
          groupBy="source"
          full={{
            identifier: LEDGER_RECORD.identifier,
            page: <IssueScenePane record={LEDGER_RECORD} isFull />,
          }}
          onSeed={seed}
        />
      );
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
};
