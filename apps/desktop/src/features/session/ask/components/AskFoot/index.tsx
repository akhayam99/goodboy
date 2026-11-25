import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { selectIsAskOpen } from '../../../../../store/slices/ask/selectIsAskOpen';
import { AskFootBody } from './AskFootBody';

type Props = {
  readonly session: Session;
};

export const AskFoot = ({ session }: Props) => {
  const sessionId = session.id;
  const isOpen = useAppStore((state) => selectIsAskOpen({ state, sessionId }));
  if (isOpen) {
    return null;
  }
  return (
    <div data-overview-ask="" className="sticky bottom-0 z-10 bg-background">
      <AskFootBody session={session} />
    </div>
  );
};
