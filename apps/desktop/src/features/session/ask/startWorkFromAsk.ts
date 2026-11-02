import type { AskThread, ChatMessage, ChatMessageId, SessionId } from '@goodboy/types';
import type { AppStore } from '../../../store/store';
import { draftWorkBrief } from '../../workspace-chat/workBrief';
import { startWorkFromChat } from '../../workspace-chat/startWorkFromChat';
import { openStartRun } from '../startRun/openStartRun';

type Params = {
  readonly sessionId: SessionId;
  readonly thread: AskThread;
  readonly messages: ReadonlyArray<ChatMessage>;
  readonly anchorMessageId: ChatMessageId;
  readonly createSession: AppStore['createSession'];
};

export const startWorkFromAsk = async ({
  sessionId,
  thread,
  messages,
  anchorMessageId,
  createSession,
}: Params): Promise<void> => {
  const anchorIndex = messages.findIndex((message) => message.id === anchorMessageId);
  const brief = draftWorkBrief({
    title: thread.title,
    messages: anchorIndex === -1 ? messages : messages.slice(0, anchorIndex + 1),
    projectNames: [],
  });
  const started = await startWorkFromChat({
    workspaceId: thread.workspaceId,
    brief,
    target: { kind: 'add', sessionId },
    createSession,
  });
  openStartRun({ sessionId: started.sessionId, text: started.ask });
};
