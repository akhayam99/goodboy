import { cn, useShellRailForm } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { selectIsAskOpen } from '../../../../../store/slices/ask/selectIsAskOpen';
import { AskPaneBody } from './AskPaneBody';

type Props = {
  readonly session: Session;
};

export const AskPane = ({ session }: Props) => {
  const sessionId = session.id;
  const isOpen = useAppStore((state) => selectIsAskOpen({ state, sessionId }));
  const closeAsk = useAppStore((state) => state.closeAsk);
  const isOverlay = useShellRailForm() === 'narrow';
  if (!isOpen) {
    return null;
  }
  return (
    <div
      data-ask-pane=""
      data-ask-overlay={isOverlay ? '' : undefined}
      className={cn(
        'panel-on-page flex min-h-0 w-100 max-w-full flex-col border-l border-border-soft bg-background',
        isOverlay ? 'absolute inset-y-0 right-0 z-30 shadow-xl' : 'relative shrink-0',
      )}
    >
      <AskPaneBody key={sessionId} session={session} onClose={() => closeAsk({ sessionId })} />
    </div>
  );
};
