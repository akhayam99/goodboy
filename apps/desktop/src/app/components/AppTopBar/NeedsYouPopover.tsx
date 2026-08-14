import {
  Divider,
  DropdownBackdrop,
  DropdownPortal,
  Popover,
  ScrollFade,
  StatusDot,
  useDropdown,
} from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { NeedsYouSessionRow } from './NeedsYouSessionRow';

type Props = {
  readonly sessions: ReadonlyArray<Session>;
  readonly count: number;
};

type SelectParams = {
  readonly sessionId: SessionId;
};

const DROPDOWN_WIDTH = 384;
const LIST_MAX_HEIGHT = 400;
const HEADER_HEIGHT = 37;
const DROPDOWN_MAX_HEIGHT = LIST_MAX_HEIGHT + HEADER_HEIGHT;

export const NeedsYouPopover = ({ sessions, count }: Props) => {
  const setCurrentSession = useAppStore((state) => state.setCurrentSession);
  const setActiveLens = useAppStore((state) => state.setActiveLens);
  const {
    open: isOpen,
    close,
    toggle,
    containerRef,
    popupRef,
    popupStyle,
    popupClassName,
    portal,
    portalTarget,
  } = useDropdown({
    align: 'center',
    width: 'w-96',
    expectedWidth: DROPDOWN_WIDTH,
    expectedHeight: DROPDOWN_MAX_HEIGHT,
    strategy: 'fixed',
    hasBackdrop: true,
  });

  const selectSession = ({ sessionId }: SelectParams) => {
    close();
    void setCurrentSession(sessionId).then(() => {
      setActiveLens(sessionId, null);
    });
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={`${count} ${count === 1 ? 'session needs' : 'sessions need'} you`}
        aria-expanded={isOpen}
        className="flex items-center gap-1 rounded px-1.5 py-1 transition-colors hover:bg-muted/50"
      >
        <StatusDot tone="warning" size="sm" pulsing />
        <span className="font-medium tabular-nums text-foreground">{count}</span>
        <span className="text-muted-foreground">need you</span>
      </button>

      <DropdownPortal portal={portal} portalTarget={portalTarget}>
        {isOpen && (
          <>
            <DropdownBackdrop onClose={close} />
            <Popover
              innerRef={popupRef}
              role="dialog"
              ariaLabel="Sessions needing attention"
              className={popupClassName}
              style={popupStyle}
            >
              <header className="flex items-center gap-2 px-3 py-2">
                <StatusDot tone="warning" size="sm" />
                <span className="text-xs font-semibold text-foreground">Needs you</span>
                <span className="ml-auto text-2xs tabular-nums text-muted-foreground">{count}</span>
              </header>
              <Divider />
              <ScrollFade className="max-h-[25rem]" fadeSize={16} fadeFrom="elevated">
                <ul aria-label="Sessions needing attention">
                  {sessions.map((session) => (
                    <NeedsYouSessionRow
                      key={session.id}
                      session={session}
                      onSelect={selectSession}
                    />
                  ))}
                </ul>
              </ScrollFade>
            </Popover>
          </>
        )}
      </DropdownPortal>
    </div>
  );
};
