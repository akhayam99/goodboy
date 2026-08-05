import { useRef, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { formatError } from '../../../../shared/lib/errors';
import { useAppStore } from '../../../../store';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly channelId: string;
  readonly threadTs: string;
  readonly isEnabled: boolean;
};

export type SlackReactionPick = {
  readonly messageTs: string;
  readonly name: string;
};

export type SlackThreadActions = {
  readonly reply: ((text: string) => Promise<void>) | null;
  readonly react: ((pick: SlackReactionPick) => void) | null;
  readonly isWriting: boolean;
  readonly error: string | null;
};

const IN_FLIGHT = 'Another Slack write is still running. Try again in a moment.';

export const useSlackThreadActions = ({
  workspaceId,
  channelId,
  threadTs,
  isEnabled,
}: Params): SlackThreadActions => {
  const replyToSlackThread = useAppStore((state) => state.replyToSlackThread);
  const addSlackReaction = useAppStore((state) => state.addSlackReaction);
  const busyRef = useRef(false);
  const [isWriting, setIsWriting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reply = async (text: string): Promise<void> => {
    if (busyRef.current) {
      throw new Error(IN_FLIGHT);
    }
    busyRef.current = true;
    setIsWriting(true);
    setError(null);
    try {
      await replyToSlackThread({ workspaceId, channelId, threadTs, text });
    } finally {
      busyRef.current = false;
      setIsWriting(false);
    }
  };

  const react = ({ messageTs, name }: SlackReactionPick): void => {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    setIsWriting(true);
    setError(null);
    void (async () => {
      try {
        await addSlackReaction({ workspaceId, channelId, threadTs, messageTs, name });
      } catch (reactionError: unknown) {
        setError(formatError(reactionError));
      } finally {
        busyRef.current = false;
        setIsWriting(false);
      }
    })();
  };

  return {
    reply: isEnabled ? reply : null,
    react: isEnabled ? react : null,
    isWriting,
    error,
  };
};
