import { StatesRestScene } from './StatesRestScene';

export const U23_STATES_REST_SCENES = {
  'chat-list-loading': () => <StatesRestScene kind="chat-loading" />,
  'artifacts-loading': () => <StatesRestScene kind="artifacts-loading" />,
  'impact-loading': () => <StatesRestScene kind="impact-loading" />,
  'commits-loading': () => <StatesRestScene kind="commits-loading" />,
  'commits-empty': () => <StatesRestScene kind="commits-empty" />,
  'terminal-empty': () => <StatesRestScene kind="terminal-empty" />,
  'permissions-empty': () => <StatesRestScene kind="permissions-empty" />,
};
