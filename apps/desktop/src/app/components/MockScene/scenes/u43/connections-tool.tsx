import type { ComponentType } from 'react';
import { ConnectionsToolScene } from './ConnectionsToolScene';

export const U43_CONNECTIONS_TOOL_SCENES: Readonly<Record<string, ComponentType>> = {
  'connections-tool-github': () => <ConnectionsToolScene tool="github" theme="light" />,
  'connections-tool-github-dark': () => <ConnectionsToolScene tool="github" theme="dark" />,
  'connections-tool-gitlab': () => <ConnectionsToolScene tool="gitlab" theme="light" />,
  'connections-tool-gitlab-dark': () => <ConnectionsToolScene tool="gitlab" theme="dark" />,
  'connections-tool-bitbucket': () => <ConnectionsToolScene tool="bitbucket" theme="light" />,
  'connections-tool-linear': () => <ConnectionsToolScene tool="linear" theme="light" />,
  'connections-tool-jira': () => <ConnectionsToolScene tool="jira" theme="light" />,
  'connections-tool-jira-dark': () => <ConnectionsToolScene tool="jira" theme="dark" />,
  'connections-tool-sentry': () => <ConnectionsToolScene tool="sentry" theme="light" />,
  'connections-tool-slack': () => <ConnectionsToolScene tool="slack" theme="light" />,
  'connections-tool-slack-dark': () => <ConnectionsToolScene tool="slack" theme="dark" />,
};
