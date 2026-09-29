import { useMemo } from 'react';
import { Listbox } from '@goodboy/ui';
import type { Project, Session, SessionId } from '@goodboy/types';
import { useProjectMountsForSessions, useSessionStages } from '../../../../store';
import { sessionPickerOptions } from './sessionPickerOptions';

type Props = {
  readonly sessions: ReadonlyArray<Session>;
  readonly projects: ReadonlyArray<Project>;
  readonly value: SessionId | null;
  readonly onChange: (sessionId: SessionId) => void;
};

export const SessionField = ({ sessions, projects, value, onChange }: Props) => {
  const stages = useSessionStages(sessions);
  const mounts = useProjectMountsForSessions({ sessions });
  const options = useMemo(
    () =>
      sessionPickerOptions({
        sessions,
        stages,
        mounts,
        projectNames: new Map(projects.map((project) => [project.id, project.name])),
        nowMs: Date.now(),
      }),
    [sessions, stages, mounts, projects],
  );
  return (
    <Listbox
      ariaLabel="Session"
      size="sm"
      isBlock
      searchable
      searchLabel="Search sessions"
      searchPlaceholder="Search sessions"
      placeholder="Pick a session"
      emptyLabel="No sessions yet"
      noMatchLabel="No sessions match"
      options={options}
      value={value}
      onChange={onChange}
    />
  );
};
