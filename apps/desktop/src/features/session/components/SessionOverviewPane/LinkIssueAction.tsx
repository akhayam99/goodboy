import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import {
  AnchoredPopover,
  Chip,
  ICON_SIZE,
  POPOVER_WIDTH_CLASS,
  POPOVER_WIDTH_PX,
  Tooltip,
  useDropdown,
} from '@goodboy/ui';
import type { Session, SessionExternalTaskProvider } from '@goodboy/types';
import { linkIssueEventName } from '../../../actions/kinds/session';
import { useShortcut } from '../../../../shared/keyboard/useShortcut';

import { LevelAddTrigger } from '../../../../shared/components/LevelAddTrigger';
import { LinkWorkPanel } from './LinkWorkPanel';
import { linkDetailOf } from './linkDetailOf';

type Props = {
  readonly session: Session;
  readonly initialSource?: SessionExternalTaskProvider;
  readonly isShortcutOn?: boolean;
  readonly look?: 'chip' | 'level';
};

const LABEL = 'Link work';

const TOOLTIP = 'Link an issue, an error or a thread to this session';

export const LinkIssueAction = ({
  session,
  initialSource,
  isShortcutOn = true,
  look = 'chip',
}: Props) => {
  const [initialQuery, setInitialQuery] = useState('');
  const [eventSource, setEventSource] = useState<SessionExternalTaskProvider | null>(null);
  const dropdown = useDropdown({
    align: 'end',
    expectedHeight: 440,
    expectedWidth: POPOVER_WIDTH_PX.studio,
    width: POPOVER_WIDTH_CLASS.studio,
    openEvent: linkIssueEventName({ sessionId: session.id }),
  });
  const { open: isOpen, toggle } = dropdown;
  const shownSource = eventSource ?? initialSource;
  useEffect(() => {
    const name = linkIssueEventName({ sessionId: session.id });
    const prefill = (event: Event) => {
      const { query, source } = linkDetailOf({
        detail: event instanceof CustomEvent ? event.detail : null,
      });
      setInitialQuery(query);
      setEventSource(source);
    };
    window.addEventListener(name, prefill);
    return () => window.removeEventListener(name, prefill);
  }, [session.id]);

  const openFresh = () => {
    setInitialQuery('');
    setEventSource(null);
    toggle();
  };

  useShortcut(
    'session.linkWork',
    (event) => {
      if (event.repeat) {
        return;
      }
      openFresh();
    },
    isShortcutOn && !isOpen,
  );

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={LABEL}
      className="overflow-hidden p-0"
      trigger={
        look === 'level' ? (
          <LevelAddTrigger
            ariaLabel={LABEL}
            tooltip={TOOLTIP}
            shortcut="session.linkWork"
            isExpanded={isOpen}
            onClick={openFresh}
          />
        ) : (
          <Tooltip content={TOOLTIP} shortcut="session.linkWork" isSuppressed={isOpen}>
            <Chip
              as="button"
              tone="neutral"
              kind="reference"
              ariaLabel={LABEL}
              hasPopup="dialog"
              expanded={isOpen}
              onClick={openFresh}
              icon={<Plus size={ICON_SIZE.row} aria-hidden />}
              label={LABEL}
            />
          </Tooltip>
        )
      }
    >
      {isOpen ? (
        <LinkWorkPanel
          key={`${eventSource ?? ''}:${initialQuery}`}
          initialQuery={initialQuery}
          {...(shownSource !== undefined ? { initialSource: shownSource } : {})}
          session={session}
          onLinked={dropdown.close}
          onClose={dropdown.close}
        />
      ) : null}
    </AnchoredPopover>
  );
};
