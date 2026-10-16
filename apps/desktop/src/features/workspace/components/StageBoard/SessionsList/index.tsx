import { ListGrid, ListGridGroup, type ListGridColumn } from '@goodboy/ui';
import type { Session, SessionGroupKey, SessionId } from '@goodboy/types';
import {
  INACTIVE_GROUP_KEY,
  type GroupedSessions,
} from '../../../../../store/slices/session-view/types';
import { sessionGroupPresentation } from '../../SessionActivityBar/groupPresentation';
import { sentenceCase } from '../../../../../shared/utils/sentenceCase';
import { SessionListRow } from './SessionListRow';

const COLUMNS: ReadonlyArray<ListGridColumn> = [
  { key: 'node', width: 28 },
  { key: 'title', width: 'fill', isTitle: true },
  { key: 'project', width: 128, tone: 'secondary' },
  { key: 'signal', width: 96, align: 'end' },
  { key: 'updated', width: 80, align: 'end', isNumeric: true, tone: 'hint' },
];

const ARCHIVED_GROUP = 'Archived';

type Props = {
  readonly groups: ReadonlyArray<GroupedSessions>;
  readonly groupMode: SessionGroupKey;
  readonly shownArchived: ReadonlyArray<Session>;
  readonly inactiveLabels: Readonly<Record<SessionId, string>>;
  readonly onOpen: (session: Session) => void;
};

type RowsParams = {
  readonly list: ReadonlyArray<Session>;
  readonly isArchived: boolean;
};

type LabelParams = {
  readonly group: GroupedSessions;
};

export const SessionsList = ({
  groups,
  groupMode,
  shownArchived,
  inactiveLabels,
  onOpen,
}: Props) => {
  const hasInactive = groups.some((group) => group.key === INACTIVE_GROUP_KEY);
  const isGrouped = groupMode !== 'none';
  const rowsOf = ({ list, isArchived }: RowsParams) =>
    list.map((session) => (
      <SessionListRow
        key={session.id}
        session={session}
        isArchived={isArchived}
        inactiveLabel={isArchived ? undefined : inactiveLabels[session.id]}
        onOpen={onOpen}
      />
    ));
  const labelOf = ({ group }: LabelParams): string | undefined => {
    if (!isGrouped && group.key !== INACTIVE_GROUP_KEY) {
      return undefined;
    }
    return sentenceCase({
      text:
        sessionGroupPresentation({ key: group.key, groupMode })?.label ?? group.label ?? group.key,
    });
  };

  if (!isGrouped && !hasInactive) {
    return (
      <ListGrid label="Sessions" columns={COLUMNS}>
        {rowsOf({ list: groups.flatMap((group) => group.sessions), isArchived: false })}
        {rowsOf({ list: shownArchived, isArchived: true })}
      </ListGrid>
    );
  }

  return (
    <ListGrid label="Sessions" columns={COLUMNS} isGrouped>
      {groups.map((group) => {
        const label = labelOf({ group });
        return (
          <ListGridGroup
            headingLevel={2}
            key={group.key}
            label={label}
            count={label === undefined ? undefined : group.sessions.length}
          >
            {rowsOf({ list: group.sessions, isArchived: false })}
          </ListGridGroup>
        );
      })}
      {shownArchived.length > 0 ? (
        <ListGridGroup headingLevel={2} label={ARCHIVED_GROUP} count={shownArchived.length}>
          {rowsOf({ list: shownArchived, isArchived: true })}
        </ListGridGroup>
      ) : null}
    </ListGrid>
  );
};
