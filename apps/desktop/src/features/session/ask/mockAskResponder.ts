import { ASK_QUESTION_MARKER } from './buildAskTurnPrompt';
import type { AskResponder } from './createMemoryAskBackend';
import { mockAskAnswer } from './mockAskAnswer';

const READ_DELAY_MS = 650;
const CHUNK_DELAY_MS = 32;
const CHUNK_SIZE = 12;

const wait = ({ ms }: { readonly ms: number }): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const mockAskResponder: AskResponder = async ({ request, onText, onRead, isCancelled }) => {
  const parts = request.prompt.split(ASK_QUESTION_MARKER);
  const question = parts.at(-1) ?? request.prompt;
  const pack = parts[0] ?? request.prompt;
  await wait({ ms: READ_DELAY_MS });
  if (isCancelled()) {
    return { status: 'done' };
  }
  onRead('notify-relay/src/webhook.ts');
  const answer = mockAskAnswer({ question, pack });
  for (let index = 0; index < answer.length; index += CHUNK_SIZE) {
    await wait({ ms: CHUNK_DELAY_MS });
    if (isCancelled()) {
      return { status: 'done' };
    }
    onText(answer.slice(index, index + CHUNK_SIZE));
  }
  return { status: 'done' };
};
