import { useRestHover, type RestHover } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';

type HoverCardTarget = {
  readonly sessionId: SessionId;
  readonly anchor: HTMLElement;
};

export type HoverCardController = Pick<
  RestHover<HoverCardTarget>,
  'target' | 'enter' | 'leave' | 'keep' | 'close'
>;

export const useHoverCardTarget = (): HoverCardController => {
  const { target, enter, leave, keep, close } = useRestHover<HoverCardTarget>({});
  return { target, enter, leave, keep, close };
};
