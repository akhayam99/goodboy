import { memo, useMemo } from 'react';
import { Notice, WorkNode } from '@goodboy/ui';
import type { ChatMessage, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { AskButtonFacts } from '../../askButtons';
import type { AskHandle } from '../../askHandles';
import { askReplyFooter } from '../../askReplyFooter';
import { useAskActions } from '../../hooks/useAskActions';
import { parseAskAnswer, type ParsedAskAnswer } from '../../parseAskAnswer';
import { AskActions } from './AskActions';
import { AskAnswer } from './AskAnswer';

type Props = {
  readonly sessionId: SessionId;
  readonly question: ChatMessage;
  readonly reply: ChatMessage | null;
  readonly facts: AskButtonFacts;
  readonly onOpen: (handle: AskHandle) => void;
};

const NO_HANDLES: ReadonlyArray<AskHandle> = [];

const EMPTY_ANSWER: ParsedAskAnswer = { blocks: [], cited: [], suggestion: null };

const AskTurnView = ({ sessionId, question, reply, facts, onOpen }: Props) => {
  const handles = useAppStore((state) =>
    reply === null ? NO_HANDLES : (state.askHandles[reply.id] ?? NO_HANDLES),
  );
  const costUsd = useAppStore((state) =>
    reply === null ? null : (state.askReplyMeta[reply.id]?.costUsd ?? null),
  );
  const content = reply?.content ?? '';
  const answer = useMemo(() => parseAskAnswer({ text: content, handles }), [content, handles]);
  const isStreaming = reply?.status === 'streaming';
  const isDone = reply?.status === 'done';
  const actions = useAskActions({ sessionId, answer: isDone ? answer : EMPTY_ANSWER, facts });
  const hasText = answer.blocks.length > 0;
  return (
    <div data-testid="ask-turn" className="flex flex-col gap-3">
      <div className="max-w-[92%] self-end rounded-lg bg-fill px-3 py-2 text-prose text-foreground">
        {question.content}
      </div>
      {reply === null ? null : (
        <div className="flex min-w-0 flex-col gap-3">
          {isStreaming && !hasText ? (
            <div className="flex items-center gap-2 text-meta text-muted-foreground">
              <WorkNode size="sm" state="running" mark={{ kind: 'dot' }} label="Reading" />
              <span>Reading the session…</span>
            </div>
          ) : null}
          {hasText ? (
            <AskAnswer blocks={answer.blocks} isStreaming={isStreaming} onOpen={onOpen} />
          ) : null}
          {reply.status === 'failed' ? (
            <Notice
              tone="danger"
              placement="inline"
              role="alert"
              title="No answer"
              body={reply.error ?? 'The provider stopped without an answer.'}
            />
          ) : null}
          {reply.status === 'stopped' ? (
            <p className="text-meta text-faint-foreground">Stopped</p>
          ) : null}
          {isDone ? <AskActions actions={actions} /> : null}
          {isStreaming ? null : (
            <p data-testid="ask-footer" className="text-meta text-faint-foreground">
              {askReplyFooter({ message: reply, costUsd })}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export const AskTurn = memo(AskTurnView);
