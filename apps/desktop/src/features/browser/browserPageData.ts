import type { ProjectId, Session, SessionId } from '@goodboy/types';
import type { BrowserTab } from '../../store/slices/browser/types';
import { sessionTitle } from '../../shared/utils/sessionTitle';
import { browserPageGroups } from './browserPageGroups';
import type { BrowserPageGroup } from './types';

type Params = {
  readonly sessionId: SessionId | null;
  readonly sessions: ReadonlyArray<Session>;
  readonly projectOf: ReadonlyArray<ProjectId | null>;
  readonly tabsOf: ReadonlyArray<ReadonlyArray<BrowserTab>>;
  readonly projectIds: ReadonlyArray<ProjectId>;
  readonly pinsOf: ReadonlyArray<ReadonlyArray<BrowserTab>>;
  readonly namesOf: ReadonlyArray<string>;
};

export type BrowserPageData = {
  readonly groups: ReadonlyArray<BrowserPageGroup>;
  readonly selectedId: SessionId | null;
};

const NO_TABS: ReadonlyArray<BrowserTab> = [];

export const browserPageData = ({
  sessionId,
  sessions,
  projectOf,
  tabsOf,
  projectIds,
  pinsOf,
  namesOf,
}: Params): BrowserPageData => {
  const rows = sessions.map((session, index) => ({
    sessionId: session.id,
    title: sessionTitle({ session }),
    projectId: projectOf[index] ?? null,
    tabs: tabsOf[index] ?? NO_TABS,
  }));
  const pins = projectIds.map((projectId, index) => ({
    projectId,
    projectName: namesOf[index] ?? '',
    pins: pinsOf[index] ?? NO_TABS,
  }));
  const pinned = new Set(
    pins.filter((project) => project.pins.length > 0).map((project) => project.projectId),
  );
  const isKnown = rows.some((row) => row.sessionId === sessionId);
  const firstHost =
    rows.find((row) => row.tabs.length > 0) ??
    rows.find((row) => row.projectId !== null && pinned.has(row.projectId));
  const selectedId = isKnown ? sessionId : (firstHost?.sessionId ?? null);
  return { groups: browserPageGroups({ sessions: rows, pins, selectedId }), selectedId };
};
