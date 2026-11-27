import type { Session, SessionId } from '@goodboy/types';
import { gitlabMountOf } from '../../../store/slices/mount-request/requestOf';
import type { MountRequestSliceState } from '../../../store/slices/mount-request/state';
import type { AppState } from '../../../store/types';
import { mergedAtOf } from '../../suggestions/signals/mergedAtOf';

type State = Pick<AppState, 'mountGithub' | 'sessionProjectMounts'> &
  Partial<Pick<MountRequestSliceState, 'mountRequests'>>;

type Params = {
  readonly state: State;
  readonly sessions: ReadonlyArray<Pick<Session, 'id'>>;
};

export type MergeFact = {
  readonly key: string;
  readonly sessionId: SessionId;
  readonly title: string;
  readonly mergedAt: string;
};

export const mergeFactsOf = ({ state, sessions }: Params): ReadonlyArray<MergeFact> =>
  sessions.flatMap((session) =>
    (state.sessionProjectMounts[session.id] ?? []).flatMap((mount) => {
      const { mountId } = mount;
      const mergedAt =
        mergedAtOf({ state, mountId, provider: 'github' }) ??
        mergedAtOf({ state, mountId, provider: 'gitlab' });
      if (mergedAt === null) {
        return [];
      }
      return [
        {
          key: String(mountId),
          sessionId: session.id,
          title:
            state.mountGithub[mountId]?.pr?.title ??
            gitlabMountOf({ state, mountId })?.mr?.title ??
            '',
          mergedAt,
        },
      ];
    }),
  );
