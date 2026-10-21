import { memo, useMemo } from 'react';
import { Notice, PANE_RHYTHM, WorkNode } from '@goodboy/ui';
import type { ChatMessage, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { useRevealedMarkdown } from '../../../../chat/reveal/useRevealedMarkdown';
import type { AskButtonFacts } from '../../askButtons';
import type { AskHandle } from '../../askHandles';
import { useAskActions } from '../../hooks/useAskActions';
import { parseAskAnswer, type ParsedAskAnswer } from '../../parseAskAnswer';
import { AskActions } from './AskActions';
import { AskAnswer } from './AskAnswer';
import { AskReplyFooter } from './AskReplyFooter';

type Props = {
  readonly sessionId: SessionId;
  readonly question: ChatMessage;
  readonly reply: ChatMessage | null;
  readonly facts: AskButtonFacts;
  readonly onOpen: (handle: AskHandle) => void;
};

const NO_HANDLES: ReadonlyArray<AskHandle> = [];

const EMPTY_ANSWER: ParsedAskAnswer = { blocks: [], cited: [], suggestion: null };

const ANSWER_ITEM_KEY = 'answer';

const AskTurnView = ({ sessionId, question, reply, facts, onOpen }: Props) => {
  const handles = useAppStore((state) =>
    reply === null ? NO_HANDLES : (state.askHandles[reply.id] ?? NO_HANDLES),
  );
  const costUsd = useAppStore((state) =>
    reply === null ? null : (state.askReplyMeta[reply.id]?.costUsd ?? null),
  );
  const content = reply?.content ?? '';
  const isStreaming = reply?.status === 'streaming';
  const reveal = useRevealedMarkdown({
    runId: reply?.id ?? question.id,
    itemKey: ANSWER_ITEM_KEY,
    text: content,
    isComplete: !isStreaming,
  });
  const isWriting = isStreaming || reveal.isRevealing;
  const answer = useMemo(() => parseAskAnswer({ text: content, handles }), [content, handles]);
  const shown = useMemo(
    () => (reveal.text === content ? answer : parseAskAnswer({ text: reveal.text, handles })),
    [reveal.text, content, answer, handles],
  );
  const isDone = reply?.status === 'done' && !reveal.isRevealing;
  const actions = useAskActions({ sessionId, answer: isDone ? answer : EMPTY_ANSWER, facts });
  const hasText = shown.blocks.length > 0;
  return (
    <div data-testid="ask-turn" className="flex flex-col gap-3">
      <div
        className={`${PANE_RHYTHM.message.user} self-end rounded-lg bg-fill px-3 py-2 text-prose text-foreground`}
      >
        {question.content}
      </div>
      {reply === null ? null : (
        <div
          ref={reveal.rootRef}
          aria-busy={isWriting ? true : undefined}
          className="flex min-w-0 flex-col gap-3"
        >
          {isWriting && !hasText ? (
            <div className="flex items-center gap-2 text-meta text-muted-foreground">
              <WorkNode size="sm" state="running" mark={{ kind: 'dot' }} label="Reading" />
              <span>Reading the session…</span>
            </div>
          ) : null}
          {hasText ? (
            <AskAnswer
              blocks={shown.blocks}
              isStreaming={isWriting}
              fresh={reveal.fresh}
              onOpen={onOpen}
            />
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
          {isWriting ? null : <AskReplyFooter message={reply} costUsd={costUsd} />}
        </div>
      )}
    </div>
  );
};

export const AskTurn = memo(AskTurnView);
