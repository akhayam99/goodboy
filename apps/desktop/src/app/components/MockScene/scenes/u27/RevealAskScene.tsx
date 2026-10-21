import { useEffect, useState } from 'react';
import { brandId } from '@goodboy/types';
import type { ChatId, ChatMessage, ChatMessageId, ChatMessageStatus } from '@goodboy/types';
import { AskTurn } from '../../../../../features/session/ask/components/AskDrawer/AskTurn';
import type { AskButtonFacts } from '../../../../../features/session/ask/askButtons';
import { liveTextRegistry } from '../../../../../features/chat/reveal/liveTextRegistry';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import { NOW, SESSION, seedActivityRunScene } from '../activityRunSeed';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly landsAfterMs: number;
};

const THREAD = brandId<ChatId>({ value: 'mock-reveal-ask-thread' });
const QUESTION_ID = brandId<ChatMessageId>({ value: 'mock-reveal-ask-question' });
const REPLY_ID = brandId<ChatMessageId>({ value: 'mock-reveal-ask-reply' });
const FACTS: AskButtonFacts = { openQuestions: [], messageableAgents: [], readyCount: 0 };

const ANSWER = [
  '**The Implementer waits on your answer about the retry budget.**',
  '',
  '- notify-relay retries a failed webhook 5 times, then drops it.',
  '- ledger-core expects at most 3 retries before it marks a payment as stuck.',
  '- The Reviewer flagged the mismatch on payments-api and is idle until you pick one.',
  '',
  'Answering keeps the Harborline release on track for today.',
].join('\n');

type MessageParams = {
  readonly id: ChatMessageId;
  readonly role: ChatMessage['role'];
  readonly content: string;
  readonly status: ChatMessageStatus;
};

const messageOf = ({ id, role, content, status }: MessageParams): ChatMessage => ({
  id,
  chatId: THREAD,
  role,
  content,
  status,
  reads: [],
  attachments: [],
  error: null,
  provider: 'anthropic',
  model: null,
  effort: null,
  createdAt: NOW,
  updatedAt: NOW,
});

const QUESTION = messageOf({
  id: QUESTION_ID,
  role: 'user',
  content: 'What needs me right now?',
  status: 'done',
});

export const RevealAskScene = ({ theme, landsAfterMs }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const [reply, setReply] = useState<ChatMessage>(() =>
    messageOf({ id: REPLY_ID, role: 'assistant', content: '', status: 'streaming' }),
  );

  useEffect(() => {
    applyDocumentTheme({ theme });
    seedActivityRunScene();
    useAppStore.setState({ sessions: [SESSION] });
    setIsReady(true);
    const timer = setTimeout(() => {
      liveTextRegistry.mark({ runId: REPLY_ID });
      setReply(messageOf({ id: REPLY_ID, role: 'assistant', content: ANSWER, status: 'done' }));
    }, landsAfterMs);
    return () => clearTimeout(timer);
  }, [theme, landsAfterMs]);

  if (!isReady) {
    return null;
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-background p-4">
      <div className="flex w-full max-w-md flex-col">
        <AskTurn
          sessionId={SESSION.id}
          question={QUESTION}
          reply={reply}
          facts={FACTS}
          onOpen={() => undefined}
        />
      </div>
    </div>
  );
};
