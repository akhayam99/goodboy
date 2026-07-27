export type AgentCardTone = 'default' | 'running' | 'attention' | 'success';

type Params = {
  readonly isRunning: boolean;
  readonly hasUnread: boolean;
};

export const agentCardTone = ({ isRunning, hasUnread }: Params): AgentCardTone => {
  if (isRunning) {
    return 'running';
  }
  if (hasUnread) {
    return 'attention';
  }
  return 'default';
};
