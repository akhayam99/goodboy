import type { Session, SessionStage, SessionStageInfo, SessionViewPrefs } from '@goodboy/types';
import { attentionCountOf } from '../../../../store/slices/session-view/attentionCountOf';
import { sortAndGroupSessions } from '../../../../store/slices/session-view/sortAndGroupSessions';
import type { GroupedSessions } from '../../../../store/slices/session-view/types';

type Params = {
  readonly groups: ReadonlyArray<GroupedSessions>;
  readonly infos: Readonly<Record<string, SessionStageInfo>>;
  readonly prefs: SessionViewPrefs;
};

type LaneParams = {
  readonly info: SessionStageInfo;
};

type MergeParams = {
  readonly quiet: ReadonlyArray<Session>;
  readonly sessions: ReadonlyArray<Session>;
  readonly prefs: SessionViewPrefs;
};

const quietLaneOf = ({ info }: LaneParams): SessionStage =>
  info.prState === null ? 'building' : 'review';

const mergedLaneOf = ({ quiet, sessions, prefs }: MergeParams): ReadonlyArray<Session> => {
  const lane = [...quiet, ...sessions];
  if (quiet.length === 0 || prefs.sort === 'needsYou') {
    return lane;
  }
  const [sorted] = sortAndGroupSessions({
    sessions: lane,
    prefs: { ...prefs, group: 'none' },
    githubState: {},
  });
  return sorted?.sessions ?? lane;
};

export const boardByStageOf = ({
  groups,
  infos,
  prefs,
}: Params): ReadonlyMap<string, ReadonlyArray<Session>> => {
  const lanes = new Map<string, ReadonlyArray<Session>>();
  const waiting = groups.find((group) => group.key === 'attention')?.sessions ?? [];
  const { countedIds } = attentionCountOf({
    items: waiting.flatMap((session) => {
      const info = infos[session.id];
      return info === undefined ? [] : [{ id: session.id, info }];
    }),
  });
  const counted = new Set(countedIds);
  const quiet = new Map<string, Array<Session>>();
  for (const session of waiting) {
    const info = infos[session.id];
    if (info === undefined || counted.has(session.id)) {
      continue;
    }
    const lane = quietLaneOf({ info });
    quiet.set(lane, [...(quiet.get(lane) ?? []), session]);
  }
  for (const group of groups) {
    if (group.key === 'attention') {
      continue;
    }
    lanes.set(
      group.key,
      mergedLaneOf({ quiet: quiet.get(group.key) ?? [], sessions: group.sessions, prefs }),
    );
  }
  for (const [lane, sessions] of quiet) {
    if (!lanes.has(lane)) {
      lanes.set(lane, sessions);
    }
  }
  return lanes;
};
