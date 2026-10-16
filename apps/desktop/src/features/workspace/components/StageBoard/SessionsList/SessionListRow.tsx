import { memo } from 'react';
import { ListGridRow, inlineMarkdownText } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { useSessionSummary } from '../../../hooks/useSessionSummary';
import { sessionRowTitle } from '../../../../session/sessionTitle';
import { SessionStateNode } from '../../SessionActivityBar/SessionStateNode';
import { sessionNodeOf } from '../../SessionActivityBar/sessionNode';
import { SessionSignal } from '../SessionSignal';
import { useSessionSignal } from '../useSessionSignal';
import { projectLineOf } from '../projectLineOf';

type Props = {
  readonly session: Session;
  readonly isArchived: boolean;
  readonly onOpen: (session: Session) => void;
};

export const SessionListRow = memo(function SessionListRow({ session, isArchived, onOpen }: Props) {
  const id = session.id;
  const summary = useSessionSummary({ session });
  const signal = useSessionSignal({ session, isArchived });
  const mounts = useAppStore((s) => s.sessionProjectMounts?.[id] ?? EMPTY_ARRAY);
  const { keys, title } = sessionRowTitle({ session, tasks: summary.tasks });
  const plainTitle = inlineMarkdownText({ text: title });
  const node = sessionNodeOf({ info: summary.info, isArchived });
  return (
    <ListGridRow
      ariaLabel={plainTitle}
      tooltip={plainTitle}
      onSelect={() => onOpen(session)}
      cells={[
        <SessionStateNode key="node" node={node} />,
        <span key="key" className="truncate font-mono">
          {keys[0] ?? ''}
        </span>,
        plainTitle,
        projectLineOf({ mounts }),
        <SessionSignal key="signal" signal={signal} />,
        summary.age,
      ]}
    />
  );
});
