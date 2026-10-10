import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { AnchoredPopover, Chip, Tooltip, useDropdown } from '@goodboy/ui';
import type { Session, SessionExternalTaskProvider } from '@goodboy/types';
import { linkIssueEventName } from '../../../actions/kinds/session';
import { withShortcutHint } from '../../../../shared/keyboard/registry';
import { useShortcut } from '../../../../shared/keyboard/useShortcut';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { LinkWorkPanel } from './LinkWorkPanel';

type Props = {
  readonly session: Session;
  readonly initialSource?: SessionExternalTaskProvider;
};

export const LinkIssueAction = ({ session, initialSource }: Props) => {
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
    !isOpen,
  );

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Link work"
      className="overflow-hidden p-0"
      trigger={
        <Tooltip
          content={withShortcutHint({
            label: 'Link an issue, an error or a thread to this session',
            shortcut: 'session.linkWork',
          })}
        >
          <Chip
            as="button"
            tone="neutral"
            shape="badge"
            kind="reference"
            ariaLabel="Link work"
            hasPopup="dialog"
            expanded={isOpen}
            onClick={() => {
              setInitialQuery('');
              toggle();
            }}
            icon={<Plus size={ICON_SIZE.row} aria-hidden />}
            label="Link work"
          />
        </Tooltip>
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
