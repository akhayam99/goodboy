import type { Session } from '@goodboy/types';
import { sessionNodeOf } from '../../../features/session/sessionNode';
import { sessionTitle } from '../../../features/session/sessionTitle';
import { SessionStateNode } from '../../../features/workspace/components/SessionActivityBar/SessionStateNode';
import { useSessionSummary } from '../../../features/workspace/hooks/useSessionSummary';

type Props = {
  readonly session: Session;
};

export const RailIdentityNode = ({ session }: Props) => {
  const summary = useSessionSummary({ session });
  const node = sessionNodeOf({ info: summary.info, isArchived: session.archivedAt != null });
  return (
    <div
      role="img"
      aria-label={`${sessionTitle({ session })}, ${node.label}`}
      data-rail-identity=""
      className="flex h-8 shrink-0 items-center pl-2"
    >
      <SessionStateNode node={node} />
    </div>
  );
};
