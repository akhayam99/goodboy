import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { AnchoredPopover, Chip, Tooltip, useDropdown } from '@goodboy/ui';
import type { Session, SessionExternalTaskProvider } from '@goodboy/types';
import { linkIssueEventName } from '../../../actions/kinds/session';
import { useShortcut } from '../../../../shared/keyboard/useShortcut';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { LevelAddTrigger } from '../../../../shared/components/LevelAddTrigger';
import { LinkWorkPanel } from './LinkWorkPanel';

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
  const dropdown = useDropdown({
    align: 'end',
    expectedHeight: 440,
    expectedWidth: 480,
    width: 'w-[34rem] max-w-[calc(100vw-2rem)]',
    openEvent: linkIssueEventName({ sessionId: session.id }),
  });
  const { open: isOpen, toggle } = dropdown;
  useEffect(() => {
    const name = linkIssueEventName({ sessionId: session.id });
    const prefill = (event: Event) => {
      const detail: unknown = event instanceof CustomEvent ? event.detail : null;
      if (
        typeof detail === 'object' &&
        detail !== null &&
        'query' in detail &&
        typeof detail.query === 'string'
      ) {
        setInitialQuery(detail.query);
        return;
      }
      setInitialQuery('');
    };
    window.addEventListener(name, prefill);
    return () => window.removeEventListener(name, prefill);
  }, [session.id]);

  useShortcut(
    'session.linkWork',
    (event) => {
      if (event.repeat) {
        return;
      }
      toggle();
    },
    isShortcutOn && !isOpen,
  );

  const openFresh = () => {
    setInitialQuery('');
    toggle();
  };

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
              shape="badge"
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
          key={initialQuery}
          initialQuery={initialQuery}
          {...(initialSource !== undefined ? { initialSource } : {})}
          session={session}
          onLinked={dropdown.close}
          onClose={dropdown.close}
        />
      ) : null}
    </AnchoredPopover>
  );
};
