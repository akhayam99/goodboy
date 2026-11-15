import type { Session } from '@goodboy/types';
import { useColumnPlace } from '../hooks/useColumnPlace';
import { SessionLevel } from './SessionRail/SessionLevel';

type Props = {
  readonly session: Session;
};

export const SessionContextCards = ({ session }: Props) => {
  const place = useColumnPlace();
  return (
    <div data-level-layer="session" className="flex max-h-72 min-h-0 shrink-0 flex-col">
      <SessionLevel session={session} isActive={place === null} />
    </div>
  );
};
