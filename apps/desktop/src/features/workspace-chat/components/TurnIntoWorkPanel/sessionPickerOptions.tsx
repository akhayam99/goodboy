import { StatusDot, type ListboxOption } from '@goodboy/ui';
import type { Session, SessionId, SessionProjectMount, SessionStage } from '@goodboy/types';
import { formatRelativeAge } from '../../../../shared/utils/relativeDate';
import { STAGE_TONE, SESSION_STAGE_META } from '../../../session/session-stage';
import { sessionTitle } from '../../../session/sessionTitle';

type Params = {
  readonly sessions: ReadonlyArray<Session>;
  readonly stages: Readonly<Record<string, SessionStage>>;
  readonly mounts: Readonly<Record<string, ReadonlyArray<SessionProjectMount>>>;
  readonly projectNames: ReadonlyMap<string, string>;
  readonly nowMs: number;
};

const ACTIVE_GROUP = 'Active';
const RECENT_GROUP = 'Recent';

const byRecency = (a: Session, b: Session): number => b.updatedAt.localeCompare(a.updatedAt);

export const sessionPickerOptions = ({
  sessions,
  stages,
  mounts,
  projectNames,
  nowMs,
}: Params): ReadonlyArray<ListboxOption<SessionId>> => {
  const stageOf = (session: Session): SessionStage => stages[session.id] ?? 'building';
  const optionOf = (session: Session, group: string): ListboxOption<SessionId> => {
    const stage = stageOf(session);
    const names = (mounts[session.id] ?? [])
      .map((mount) => projectNames.get(mount.projectId) ?? '')
      .filter((name) => name !== '');
    const age = formatRelativeAge({ fromIso: session.updatedAt, nowMs });
    return {
      value: session.id,
      label: sessionTitle({ session }),
      group,
      leading: <StatusDot tone={STAGE_TONE[stage]} pulsing={stage === 'running'} />,
      meta: [SESSION_STAGE_META[stage].label, age].filter((part) => part !== '').join(' · '),
      ...(names.length > 0 && { description: names.join(', '), keywords: names.join(' ') }),
    };
  };
  const active = sessions
    .filter((session) => stageOf(session) !== 'done')
    .sort(byRecency)
    .map((session) => optionOf(session, ACTIVE_GROUP));
  const recent = sessions
    .filter((session) => stageOf(session) === 'done')
    .sort(byRecency)
    .map((session) => optionOf(session, RECENT_GROUP));
  return [...active, ...recent];
};
