import { Pin, PinOff } from 'lucide-react';
import { OverflowMenu, type OverflowMenuItem } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useActionEnv } from '../../../actions/useActionEnv';
import { useObjectActions } from '../../../actions/useObjectActions';
import { useSessionPin } from '../../../actions/useSessionPin';
import { useSessionArchive } from '../../hooks/useSessionArchive';
import { useSessionRefresh } from '../../hooks/useSessionRefresh';

type Props = {
  readonly session: Session;
  readonly onDelete: () => void;
};

const MENU_LABEL = 'More session actions';

export const SessionHeaderMenu = ({ session, onDelete }: Props) => {
  const sessionId = session.id as SessionId;
  const env = useActionEnv({ origin: 'menu' });
  const object = useObjectActions({ target: { kind: 'session', sessionId }, env });
  const writeAction = object.actions.find((action) => action.id === 'session.writeFromWork');
  const { archive, restore } = useSessionArchive();
  const refresh = useSessionRefresh();
  const isRefreshing = useAppStore((s) => s.sessionSyncing[sessionId] === true);
  const pin = useSessionPin({ session });
  const isArchived = session.archivedAt != null;

  const liveItems: ReadonlyArray<OverflowMenuItem> = isArchived
    ? []
    : [
        {
          kind: 'item',
          key: 'refresh',
          label: isRefreshing ? 'Refreshing' : 'Refresh',
          icon: CONCEPT_ICONS.refresh,
          hint: shortcutGlyphs('session.refresh'),
          disabled: isRefreshing,
          onClick: () => void refresh({ sessionId }),
        },
        {
          kind: 'item',
          key: 'pin',
          label: pin.label,
          icon: pin.isPinned ? PinOff : Pin,
          onClick: pin.toggle,
        },
        { kind: 'separator', key: 'separator-live' },
      ];

  const items: ReadonlyArray<OverflowMenuItem> = [
    ...liveItems,
    ...(writeAction === undefined
      ? []
      : [
          {
            kind: 'item' as const,
            key: writeAction.id,
            label: writeAction.label,
            icon: writeAction.icon,
            onClick: () => void object.run({ actionId: writeAction.id }),
          },
        ]),
    {
      kind: 'item',
      key: 'archive',
      label: isArchived ? 'Unarchive session' : 'Archive session',
      icon: isArchived ? CONCEPT_ICONS.restore : CONCEPT_ICONS.archive,
      hint: shortcutGlyphs('session.archive'),
      onClick: () => void (isArchived ? restore : archive)({ sessions: [session] }),
    },
    {
      kind: 'item',
      key: 'delete',
      label: 'Delete session…',
      icon: CONCEPT_ICONS.delete,
      hint: shortcutGlyphs('session.delete'),
      destructive: true,
      onClick: onDelete,
    },
  ];

  return <OverflowMenu items={items} label={MENU_LABEL} size="control" />;
};
