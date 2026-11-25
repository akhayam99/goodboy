import type { InvokeArgs } from '@tauri-apps/api/core';
import {
  STORY_EXAMPLE_KEY,
  STORY_SLACK_CHANNELS,
  STORY_SLACK_USERS,
  STORY_VIEWER,
  storyGithubIssues,
  storyGithubPrs,
  storyGitlabIssues,
  storyGitlabMrs,
  storyLinearIssues,
  storySentryDetail,
  storySentryIssues,
  storySlackHeads,
  storySlackThread,
} from './storyTasks';

type AnswerParams = {
  readonly command: string;
  readonly payload: InvokeArgs | undefined;
};

type FieldParams = {
  readonly payload: InvokeArgs | undefined;
  readonly key: string;
};

const fieldOf = ({ payload, key }: FieldParams): unknown => {
  if (payload === undefined || Array.isArray(payload) || payload instanceof ArrayBuffer) {
    return undefined;
  }
  if (payload instanceof Uint8Array) {
    return undefined;
  }
  return payload[key];
};

const stringsOf = ({ payload, key }: FieldParams): ReadonlyArray<string> => {
  const value = fieldOf({ payload, key });
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
};

type GhParams = {
  readonly args: ReadonlyArray<string>;
};

const ghStdoutOf = ({ args }: GhParams): string => {
  if (args[0] === 'repo') {
    return 'harborline/payments-api\n';
  }
  if (args[0] === 'pr' && args[1] === 'list') {
    return JSON.stringify(
      args.some((arg) => arg.startsWith('review-requested')) ? storyGithubPrs() : [],
    );
  }
  if (args[0] === 'issue' && args[1] === 'list') {
    return JSON.stringify(storyGithubIssues());
  }
  if (args[0] === 'issue' && args[1] === 'view') {
    return JSON.stringify({ ...storyGithubIssues()[0], comments: [] });
  }
  return '[]';
};

type PayloadParams = {
  readonly payload: InvokeArgs | undefined;
};

const isAcceptedKey = ({ payload }: PayloadParams): boolean => {
  const token = fieldOf({ payload, key: 'token' });
  return token === STORY_EXAMPLE_KEY || token === null || token === undefined;
};

export const storyIpcAnswer = ({ command, payload }: AnswerParams): unknown => {
  switch (command) {
    case 'linear_validate_connection':
      if (!isAcceptedKey({ payload })) {
        throw new Error('Linear did not accept that API key');
      }
      return STORY_VIEWER;
    case 'linear_connect':
      return null;
    case 'linear_fetch_assigned_issues':
      return storyLinearIssues();
    case 'linear_fetch_issue_comments':
      return [];
    case 'gh_run':
      return {
        stdout: ghStdoutOf({ args: stringsOf({ payload, key: 'args' }) }),
        stderr: '',
        exitCode: 0,
      };
    case 'gitlab_fetch_assigned_mrs':
      return storyGitlabMrs();
    case 'gitlab_fetch_assigned_issues':
      return storyGitlabIssues();
    case 'sentry_fetch_issues':
      return { issues: storySentryIssues(), next_cursor: null };
    case 'sentry_fetch_issue_detail':
      return storySentryDetail();
    case 'sentry_list_code_mappings':
      return [];
    case 'slack_list_channels':
      return STORY_SLACK_CHANNELS;
    case 'slack_list_users':
      return STORY_SLACK_USERS;
    case 'slack_list_thread_heads': {
      const channelId = fieldOf({ payload, key: 'channelId' });
      return typeof channelId === 'string' ? storySlackHeads({ channelId }) : [];
    }
    case 'slack_get_thread': {
      const channelId = fieldOf({ payload, key: 'channelId' });
      const threadTs = fieldOf({ payload, key: 'threadTs' });
      if (typeof channelId !== 'string' || typeof threadTs !== 'string') {
        return [];
      }
      const head = storySlackHeads({ channelId }).find((entry) => entry.ts === threadTs);
      return storySlackThread({ head, channelId });
    }
    default:
      return undefined;
  }
};
