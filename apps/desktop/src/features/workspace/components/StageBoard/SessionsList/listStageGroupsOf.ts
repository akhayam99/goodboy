import type { Tone } from '@goodboy/ui';
import type { Session, SessionStage } from '@goodboy/types';
import { stageTrackOf } from '../../../../session/stageTrackOf';
import { stageWord } from '../../SessionHoverCard/stageWord';
import { BOARD_STAGES } from '../boardStages';

const ARCHIVED_LIST_GROUP = 'Archived';

export type ListStageGroup = {
  readonly key: SessionStage | 'archived';
  readonly label: string;
  readonly tone: Tone;
  readonly sessions: ReadonlyArray<Session>;
};

type Params = {
  readonly byStage: ReadonlyMap<string, ReadonlyArray<Session>>;
  readonly statusFilter: ReadonlyArray<SessionStage>;
  readonly archived: ReadonlyArray<Session>;
};

export const listStageGroupsOf = ({
  byStage,
  statusFilter,
  archived,
}: Params): ReadonlyArray<ListStageGroup> => {
  const stages =
    statusFilter.length > 0
      ? BOARD_STAGES.filter((stage) => statusFilter.includes(stage))
      : BOARD_STAGES;
  const live = stages.flatMap((stage): ReadonlyArray<ListStageGroup> => {
    const sessions = byStage.get(stage) ?? [];
    if (sessions.length === 0) {
      return [];
    }
    return [
      {
        key: stage,
        label: stageWord({ stage }),
        tone: stageTrackOf({ stage, isArchived: false }).tone,
        sessions,
      },
    ];
  });
  if (archived.length === 0) {
    return live;
  }
  return [
    ...live,
    {
      key: 'archived',
      label: ARCHIVED_LIST_GROUP,
      tone: stageTrackOf({ stage: 'done', isArchived: true }).tone,
      sessions: archived,
    },
  ];
};
