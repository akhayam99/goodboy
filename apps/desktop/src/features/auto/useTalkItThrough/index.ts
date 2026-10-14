import { useCallback } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { talkItThroughGoal } from '../talkItThroughGoal';
import { useIsAutoOn } from '../useIsAutoOn';

type Params = {
  readonly sessionId: SessionId;
};

type TalkParams = {
  readonly title: string;
  readonly detail: string | null;
};

export type TalkItThrough = Readonly<{
  isAvailable: boolean;
  talk: (params: TalkParams) => void;
}>;

export const useTalkItThrough = ({ sessionId }: Params): TalkItThrough => {
  const isAutoOn = useIsAutoOn();
  const openDrawer = useAppStore((state) => state.openDrawer);
  const setNewDrawerAutoGoal = useAppStore((state) => state.setNewDrawerAutoGoal);

  const talk = useCallback(
    ({ title, detail }: TalkParams): void => {
      setNewDrawerAutoGoal({ sessionId, goal: talkItThroughGoal({ title, detail }) });
      openDrawer({ kind: 'new', sessionId, payload: { tab: 'agent' } });
    },
    [openDrawer, sessionId, setNewDrawerAutoGoal],
  );

  return { isAvailable: isAutoOn, talk };
};
