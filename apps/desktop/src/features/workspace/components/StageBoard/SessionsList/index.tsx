import { ListGrid, ListGridGroup, StatusDot, type ListGridColumn } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import type { ListStageGroup } from './listStageGroupsOf';
import { SessionListRow } from './SessionListRow';

const COLUMNS: ReadonlyArray<ListGridColumn> = [
  { key: 'node', width: 28 },
  { key: 'title', width: 'fill', isTitle: true },
  { key: 'project', width: 128, tone: 'secondary' },
  { key: 'signal', width: 96, align: 'end' },
  { key: 'updated', width: 80, align: 'end', isNumeric: true, tone: 'hint' },
];

type Props = {
  readonly groups: ReadonlyArray<ListStageGroup>;
  readonly inactiveLabels: Readonly<Record<SessionId, string>>;
  readonly onOpen: (session: Session) => void;
};

export const SessionsList = ({ groups, inactiveLabels, onOpen }: Props) => (
  <ListGrid label="Sessions" columns={COLUMNS} isGrouped>
    {groups.map((group) => {
      const isArchived = group.key === 'archived';
      return (
        <ListGridGroup
          headingLevel={2}
          key={group.key}
          label={group.label}
          mark={<StatusDot tone={group.tone} size="sm" />}
          count={group.sessions.length}
        >
          {group.sessions.map((session) => (
            <SessionListRow
              key={session.id}
              session={session}
              isArchived={isArchived}
              inactiveLabel={isArchived ? undefined : inactiveLabels[session.id]}
              onOpen={onOpen}
            />
          ))}
        </ListGridGroup>
      );
    })}
  </ListGrid>
);
