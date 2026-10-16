import { ListGrid, ListGridGroup, type ListGridColumn } from '@goodboy/ui';
import type { Session, SessionGroupKey } from '@goodboy/types';
import type { GroupedSessions } from '../../../../../store/slices/session-view/types';
import { sessionGroupPresentation } from '../../SessionActivityBar/groupPresentation';
import { sentenceCase } from '../../../../../shared/utils/sentenceCase';
import { SessionListRow } from './SessionListRow';

const COLUMNS: ReadonlyArray<ListGridColumn> = [
  { key: 'node', width: 16 },
  { key: 'key', width: 72, tone: 'hint' },
  { key: 'title', width: 'fill', isTitle: true },
  { key: 'project', width: 128, tone: 'secondary' },
  { key: 'signal', width: 96, align: 'end' },
  { key: 'updated', width: 56, align: 'end', isNumeric: true, tone: 'hint' },
];

const ARCHIVED_GROUP = 'Archived';

type Props = {
  readonly groups: ReadonlyArray<GroupedSessions>;
  readonly groupMode: SessionGroupKey;
  readonly shownArchived: ReadonlyArray<Session>;
  readonly onOpen: (session: Session) => void;
};

export const SessionsList = ({ groups, groupMode, shownArchived, onOpen }: Props) => {
  const isGrouped = groupMode !== 'none';
  const rowsOf = (list: ReadonlyArray<Session>, isArchived: boolean) =>
    list.map((session) => (
      <SessionListRow key={session.id} session={session} isArchived={isArchived} onOpen={onOpen} />
    ));

  if (!isGrouped) {
    return (
      <ListGrid label="Sessions" columns={COLUMNS}>
        {rowsOf(
          groups.flatMap((group) => group.sessions),
          false,
        )}
        {rowsOf(shownArchived, true)}
      </ListGrid>
    );
  }

  return (
    <ListGrid label="Sessions" columns={COLUMNS} isGrouped>
      {groups.map((group) => (
        <ListGridGroup
          headingLevel={2}
          key={group.key}
          label={sentenceCase({
            text:
              sessionGroupPresentation({ key: group.key, groupMode })?.label ??
              group.label ??
              group.key,
          })}
          count={group.sessions.length}
        >
          {rowsOf(group.sessions, false)}
        </ListGridGroup>
      ))}
      {shownArchived.length > 0 ? (
        <ListGridGroup headingLevel={2} label={ARCHIVED_GROUP} count={shownArchived.length}>
          {rowsOf(shownArchived, true)}
        </ListGridGroup>
      ) : null}
    </ListGrid>
  );
};
