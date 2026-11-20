import { useCallback } from 'react';
import { transientEscapeLayerCount } from '@goodboy/ui';
import { useEscapeArm } from '../../../../../../shared/hooks/useEscapeArm';
import { isOverlayOpen } from '../../../../../../shared/keyboard/isOverlayOpen';
import { useShortcut } from '../../../../../../shared/keyboard/useShortcut';
import type { ConversationStop } from '../../../../../../shared/types/conversationStop';

type Params = {
  readonly stop: ConversationStop | null;
  readonly isCovered: boolean;
};

type Result = Readonly<{
  isArmed: boolean;
  onEscape: () => boolean;
}>;

export const useEscapeStop = ({ stop, isCovered }: Params): Result => {
  const isBlocked = useCallback(() => transientEscapeLayerCount() > 0 || isOverlayOpen({}), []);
  const { isArmed, onEscape } = useEscapeArm({
    press: stop?.stop ?? null,
    isStopping: stop?.phase === 'stopping',
    isBlocked,
  });

  useShortcut('agent.stop', onEscape, stop !== null && !isCovered, { canDecline: true });

  return { isArmed, onEscape };
};
