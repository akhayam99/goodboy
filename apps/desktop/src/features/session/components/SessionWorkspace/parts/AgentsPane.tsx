import type { ReactNode } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import { CreateAgentPopover } from '../../CreateAgentPopover';
import { StandaloneAgentsLane } from '../../StandaloneAgentsLane';
import { PaneShell } from '../../../../../shared/components/PaneShell';

type Props = {
  readonly session: Session;
  readonly meta: string | undefined;
  readonly eyebrow?: ReactNode;
};

export const AgentsPane = ({ session, meta, eyebrow }: Props) => {
  const sessionId = session.id as SessionId;

  return (
    <PaneShell
      title="Agents"
      description="Agents you spawn by hand to work this session."
      meta={meta}
      eyebrow={eyebrow}
      actions={<CreateAgentPopover sessionId={sessionId} variant="compact" />}
    >
      <StandaloneAgentsLane session={session} variant="lens" showCompleted />
    </PaneShell>
  );
};
