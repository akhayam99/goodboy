import type { ComponentProps } from 'react';
import type { TimelineAgentEntry } from '../../../../timeline/buildTimelineGroups';
import { useAgentRowProvider } from '../../../../hooks/useAgentRowProvider';
import { TimelineFoldStreamRow } from './TimelineFoldStreamRow';

type Props = Omit<ComponentProps<typeof TimelineFoldStreamRow>, 'entry' | 'provider'> & {
  readonly entry: TimelineAgentEntry;
};

export const TimelineFoldAgentStreamRow = (props: Props) => {
  const provider = useAgentRowProvider({ agent: props.entry.agent });
  return <TimelineFoldStreamRow {...props} provider={provider} />;
};
