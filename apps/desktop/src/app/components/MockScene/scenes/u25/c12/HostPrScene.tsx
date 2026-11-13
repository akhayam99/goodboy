import { useCallback } from 'react';
import type { InboxRecord } from '../../../../../../features/inbox/types';
import { mockSceneIpc } from '../../mockSceneIpc';
import { HOST_BITBUCKET_STATUSES } from './hostPrSeed';
import { IssueScenePane } from './IssueScenePane';
import { TasksStage } from './TasksStage';
import { WORKSPACE_TASKS } from './tasksSeed';

type Props = {
  readonly record: InboxRecord;
};

type GhRunParams = {
  readonly payload: unknown;
};

const ghRunAnswer = ({ payload }: GhRunParams) => {
  const isRepoView =
    typeof payload === 'object' &&
    payload !== null &&
    'args' in payload &&
    Array.isArray(payload.args) &&
    payload.args[0] === 'repo';
  return { stdout: isRepoView ? 'harborline/ledger-core\n' : '[]', stderr: '', exitCode: 0 };
};

const installIpc = (): void => {
  mockSceneIpc((command, payload) => {
    if (command === 'gh_run') {
      return ghRunAnswer({ payload });
    }
    if (command === 'bitbucket_list_pull_request_statuses') {
      return HOST_BITBUCKET_STATUSES;
    }
    if (command === 'gitlab_mr_approval_state') {
      return {
        approvalsRequired: 2,
        approvalsLeft: 1,
        userHasApproved: false,
        userCanApprove: true,
        approvedBy: [{ user: { username: 'acme-ops', name: 'acme-ops', avatarUrl: null } }],
      };
    }
    if (command === 'bitbucket_pull_request_diff') {
      return '';
    }
    if (command.includes('comments') || command.includes('discussions')) {
      return [];
    }
    return null;
  });
};

export const HostPrScene = ({ record }: Props) => {
  const seed = useCallback(() => installIpc(), []);
  return (
    <TasksStage
      records={[record, ...WORKSPACE_TASKS]}
      scope="all"
      groupBy="source"
      selectedKey={record.key}
      cursorKey={record.key}
      connected={['github', 'gitlab', 'bitbucket', 'linear', 'jira', 'sentry', 'slack']}
      drawer={<IssueScenePane record={record} />}
      onSeed={seed}
    />
  );
};
