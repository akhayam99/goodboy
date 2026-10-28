import type { Agent } from '@goodboy/types';
import { useAgentOutcome } from '../../../../shared/hooks/useAgentOutcome';
import { ChecksSkippedNotice } from './ChecksSkippedNotice';

type Props = {
  readonly agent: Agent;
};

export const FixRunAgentChecks = ({ agent }: Props) => {
  const outcome = useAgentOutcome({ agent });
  return <ChecksSkippedNotice text={outcome.text} />;
};
