import { useEffect } from 'react';
import { Plus } from 'lucide-react';
import { AnchoredPopover, Chip, KbdPill, Tooltip, useDropdown } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { linkIssueEventName } from '../../../actions/kinds/session';
import { eventMatches } from '../../../../shared/keyboard/dispatcher';
import { isTerminalFocused } from '../../../../shared/keyboard/isTerminalFocused';
import { SHORTCUTS, shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { LinkWorkPanel } from './LinkWorkPanel';

type Props = {
  readonly session: Session;
};

const isTypingTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT');

export const LinkIssueAction = ({ session }: Props) => {
  const dropdown = useDropdown({
    align: 'end',
    expectedHeight: 440,
    expectedWidth: 480,
    width: 'w-[30rem] max-w-[calc(100vw-2rem)]',
    openEvent: linkIssueEventName({ sessionId: session.id }),
  });
  const { open: isOpen, toggle } = dropdown;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isOpen || event.repeat || event.defaultPrevented) {
        return;
      }
      if (!eventMatches({ event, entry: SHORTCUTS['session.linkWork'] })) {
        return;
      }
      if (isTypingTarget(event.target) || isTerminalFocused()) {
        return;
      }
      if (document.querySelector('[role="dialog"][aria-modal="true"]') !== null) {
        return;
      }
      event.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, toggle]);

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Link work"
      className="overflow-hidden p-0"
      trigger={
        <Tooltip content="Link an issue, an error or a thread to this session">
          <Chip
            as="button"
            tone="neutral"
            shape="badge"
            size="control"
            ariaLabel="Link work"
            hasPopup="dialog"
            expanded={isOpen}
            onClick={toggle}
            icon={<Plus size={ICON_SIZE.row} aria-hidden />}
            label="Link work"
            trailing={<KbdPill aria-hidden>{shortcutGlyphs('session.linkWork')}</KbdPill>}
          />
        </Tooltip>
      }
    >
      {isOpen ? (
        <LinkWorkPanel session={session} onLinked={dropdown.close} onClose={dropdown.close} />
      ) : null}
    </AnchoredPopover>
  );
};
