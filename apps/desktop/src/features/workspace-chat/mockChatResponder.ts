import type { ChatResponder } from './createMemoryChatBackend';
import { pickMockChatAnswer } from './mockChatAnswers';

const READ_DELAY_MS = 180;
const CHUNK_DELAY_MS = 32;
const CHUNK_SIZE = 18;
const QUESTION_MARKER = 'New question:\n';

type WaitParams = {
  readonly ms: number;
};

const wait = ({ ms }: WaitParams): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

type ChunkParams = {
  readonly text: string;
};

const chunksOf = ({ text }: ChunkParams): ReadonlyArray<string> => {
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += CHUNK_SIZE) {
    chunks.push(text.slice(index, index + CHUNK_SIZE));
  }
  return chunks;
};

export const mockChatResponder: ChatResponder = async ({
  request,
  onText,
  onRead,
  isCancelled,
}) => {
  const question = request.prompt.split(QUESTION_MARKER).at(-1) ?? request.prompt;
  const answer = pickMockChatAnswer({ question });
  for (const path of answer.reads) {
    await wait({ ms: READ_DELAY_MS });
    if (isCancelled()) {
      return { status: 'done' };
    }
    onRead(path);
  }
  for (const chunk of chunksOf({ text: answer.text })) {
    await wait({ ms: CHUNK_DELAY_MS });
    if (isCancelled()) {
      return { status: 'done' };
    }
    onText(chunk);
  }
  return { status: 'done' };
};
