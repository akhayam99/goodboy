import type { ProjectId, SessionId } from '@goodboy/types';
import type { BrowserPageGroup, BrowserPagePins, BrowserPageSession } from './types';

type Params = {
  readonly sessions: ReadonlyArray<BrowserPageSession>;
  readonly pins: ReadonlyArray<BrowserPagePins>;
  readonly selectedId: SessionId | null;
};

type HostParams = {
  readonly projectId: ProjectId;
  readonly sessions: ReadonlyArray<BrowserPageSession>;
  readonly selectedId: SessionId | null;
};

const hostSessionOf = ({ projectId, sessions, selectedId }: HostParams): SessionId | null => {
  const hosts = sessions.filter((session) => session.projectId === projectId);
  const selected = hosts.filter((host) => host.sessionId === selectedId);
  return (selected[0] ?? hosts[0])?.sessionId ?? null;
};

export const browserPageGroups = ({
  sessions,
  pins,
  selectedId,
}: Params): ReadonlyArray<BrowserPageGroup> => {
  const sessionGroups = sessions
    .filter((session) => session.tabs.length > 0 || session.sessionId === selectedId)
    .map((session): BrowserPageGroup => ({
      key: `session:${session.sessionId}`,
      label: session.title,
      sessionId: session.sessionId,
      tabs: session.tabs,
      isPins: false,
    }));
  const pinGroups = pins.flatMap((project): ReadonlyArray<BrowserPageGroup> => {
    const sessionId = hostSessionOf({ projectId: project.projectId, sessions, selectedId });
    if (sessionId === null || project.pins.length === 0) {
      return [];
    }
    return [
      {
        key: `pins:${project.projectId}`,
        label: `Pinned for ${project.projectName}`,
        sessionId,
        tabs: project.pins,
        isPins: true,
      },
    ];
  });
  return [...sessionGroups, ...pinGroups];
};
