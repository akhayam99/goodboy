import { useCallback, useState } from 'react';
import type { ConversationMessage } from '../types';

export type ReplyTarget = {
  readonly threadId: string;
  readonly message: ConversationMessage;
  readonly mode: 'thread' | 'quote';
};

type Result = {
  readonly target: ReplyTarget | null;
  readonly choose: (target: ReplyTarget) => void;
  readonly clear: () => void;
};

export const useReplyTarget = (): Result => {
  const [target, setTarget] = useState<ReplyTarget | null>(null);
  const choose = useCallback((next: ReplyTarget) => setTarget(next), []);
  const clear = useCallback(() => setTarget(null), []);
  return { target, choose, clear };
};
