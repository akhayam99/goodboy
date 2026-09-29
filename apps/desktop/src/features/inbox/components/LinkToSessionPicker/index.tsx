import { useMemo, useState } from 'react';
import { Link2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import type { IsoDateTime, SessionId, WorkspaceId } from '@goodboy/types';
import { Listbox, type ListboxOption } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import { sessionTitle } from '../../../session/sessionTitle';
import type { LaunchExternalTask } from '../../launchSpecFor';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly task: LaunchExternalTask;
};

export const LinkToSessionPicker = ({ workspaceId, task }: Props) => {
  const sessions = useAppStore(
    useShallow((state) => state.sessions.filter((session) => session.workspaceId === workspaceId)),
  );
  const linkSessionExternalTask = useAppStore((state) => state.linkSessionExternalTask);
  const reportError = useAppStore((state) => state.reportError);
  const [isLinking, setIsLinking] = useState(false);
  const options = useMemo(
    (): ReadonlyArray<ListboxOption<string>> =>
      [...sessions]
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .map((session) => ({ value: session.id, label: sessionTitle({ session }) })),
    [sessions],
  );

  if (options.length === 0) {
    return null;
  }

  const link = async (sessionId: SessionId) => {
    setIsLinking(true);
    try {
      await linkSessionExternalTask(sessionId, {
        ...task,
        createdAt: new Date().toISOString() as IsoDateTime,
      });
    } catch (error: unknown) {
      void reportError({ title: "Couldn't link the session", error });
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <Listbox
      trigger="field"
      size="sm"
      searchable
      isBlock
      popupWidth="trigger"
      ariaLabel="Link to a session"
      searchLabel="Search sessions"
      searchPlaceholder="Search sessions"
      noun="session"
      disabled={isLinking}
      value={null}
      options={options}
      valueLabel={
        <>
          <Link2 size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground" />
          <span className="truncate">Link to a session</span>
        </>
      }
      onChange={(value) => void link(value as SessionId)}
    />
  );
};
