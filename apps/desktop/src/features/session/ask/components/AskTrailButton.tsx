import { KbdPill, Tooltip, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectOpenDrawer } from '../../../../store/slices/drawer/selectOpenDrawer';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { useShortcut } from '../../../../shared/keyboard/useShortcut';
import { requestAskFocus } from '../askFocusEvent';

type Props = {
  readonly sessionId: SessionId;
};

const AskIcon = CONCEPT_ICONS.ask;

export const AskTrailButton = ({ sessionId }: Props) => {
  const isOpen = useAppStore((state) => {
    const drawer = selectOpenDrawer(state);
    return drawer?.kind === 'ask' && drawer.sessionId === sessionId;
  });
  const isCurrent = useAppStore(
    (state) => state.currentSessionId === sessionId && state.appStudio === null,
  );
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  const openAsk = useAppStore((state) => state.openAsk);
  const glyphs = shortcutGlyphs('ask.open');

  useShortcut(
    'ask.open',
    (event) => {
      event.preventDefault();
      if (!isOpen) {
        openAsk({ sessionId });
      }
      requestAskFocus();
    },
    isCurrent,
  );

  return (
    <Tooltip content={`Ask what is happening in this session ${glyphs}`}>
      <button
        type="button"
        data-testid="ask-trail-button"
        aria-pressed={isOpen}
        onClick={() => (isOpen ? closeDrawer() : openAsk({ sessionId }))}
        className={cn(
          'flex h-6 shrink-0 items-center gap-1 rounded-md pl-2 pr-1 text-label text-muted-foreground motion-safe:transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
          isOpen && 'bg-fill text-foreground',
        )}
      >
        <AskIcon size={ICON_SIZE.row} aria-hidden />
        <span>Ask</span>
        <KbdPill aria-hidden>{glyphs}</KbdPill>
      </button>
    </Tooltip>
  );
};
