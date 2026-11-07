import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatError } from '@goodboy/ui';
import { mergeOutbox, outboxMessageId, type OutboxEntry } from '../mergeOutbox';
import { quoteBody } from '../quoteBody';
import type { ConversationSource, ConversationThread } from '../types';
import { useReplyTarget, type ReplyTarget } from '../useReplyTarget';

type Params = {
  readonly source: ConversationSource;
  readonly resetKey: string;
};

export type ConversationFailure = {
  readonly error: string;
  readonly body: string;
  readonly retry: () => void;
  readonly discard: () => void;
};

export type ConversationModel = {
  readonly threads: ReadonlyArray<ConversationThread>;
  readonly target: ReplyTarget | null;
  readonly focusToken: number;
  readonly canSend: boolean;
  readonly choose: (target: ReplyTarget) => void;
  readonly clearTarget: () => void;
  readonly send: (text: string) => void;
  readonly failureOf: (messageId: string) => ConversationFailure | null;
};

export const useConversation = ({ source, resetKey }: Params): ConversationModel => {
  const { target, choose: chooseTarget, clear: clearTarget } = useReplyTarget();
  const [outbox, setOutbox] = useState<ReadonlyArray<OutboxEntry>>([]);
  const [focusToken, setFocusToken] = useState(0);
  const counter = useRef(0);
  const onPost = source.onPost;

  useEffect(() => {
    clearTarget();
    setOutbox([]);
  }, [resetKey, clearTarget]);

  const deliver = useCallback(
    (entry: OutboxEntry) => {
      if (onPost == null) {
        return;
      }
      setOutbox((current) =>
        current.map((item) =>
          item.id === entry.id ? { ...item, status: 'sending', error: null } : item,
        ),
      );
      onPost({ body: entry.body, threadId: entry.threadId })
        .then(() => {
          setOutbox((current) => current.filter((item) => item.id !== entry.id));
        })
        .catch((postError: unknown) => {
          setOutbox((current) =>
            current.map((item) =>
              item.id === entry.id
                ? { ...item, status: 'failed', error: formatError(postError) }
                : item,
            ),
          );
        });
    },
    [onPost],
  );

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (onPost == null || trimmed === '') {
        return;
      }
      counter.current += 1;
      const entry: OutboxEntry = {
        id: `${resetKey}:${counter.current}`,
        threadId: target?.mode === 'thread' ? target.threadId : null,
        body:
          target?.mode === 'quote'
            ? quoteBody({ message: target.message, text: trimmed })
            : trimmed,
        createdAt: new Date().toISOString(),
        status: 'sending',
        error: null,
      };
      setOutbox((current) => [...current, entry]);
      clearTarget();
      deliver(entry);
    },
    [onPost, resetKey, target, clearTarget, deliver],
  );

  const choose = useCallback(
    (next: ReplyTarget) => {
      chooseTarget(next);
      setFocusToken((token) => token + 1);
    },
    [chooseTarget],
  );

  const failureOf = useCallback(
    (messageId: string): ConversationFailure | null => {
      const entry = outbox.find((item) => outboxMessageId({ entry: item }) === messageId);
      if (entry == null || entry.status !== 'failed') {
        return null;
      }
      return {
        error: entry.error ?? 'The tool did not accept the message.',
        body: entry.body,
        retry: () => deliver(entry),
        discard: () => setOutbox((current) => current.filter((item) => item.id !== entry.id)),
      };
    },
    [outbox, deliver],
  );

  const threads = useMemo(
    () => mergeOutbox({ threads: source.threads, outbox }),
    [source.threads, outbox],
  );

  return {
    threads,
    target,
    focusToken,
    canSend: onPost != null,
    choose,
    clearTarget,
    send,
    failureOf,
  };
};
