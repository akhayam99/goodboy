import type { AskResponder } from '../../../../../test/createMemoryAskBackend';
import { mockAskAnswer } from './mockAskAnswer';

const QUESTION_MARKER = 'New question:\n';

const READ_DELAY_MS = 650;
const CHUNK_DELAY_MS = 32;
const CHUNK_SIZE = 12;

const wait = ({ ms }: { readonly ms: number }): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

type PromptParams = {
  readonly prompt: string;
};

export const askPromptParts = ({ prompt }: PromptParams) => {
  const parts = prompt.split(QUESTION_MARKER);
  return { question: parts.at(-1) ?? prompt, pack: parts[0] ?? prompt };
};

export const mockAskResponder: AskResponder = async ({ request, onText, onRead, isCancelled }) => {
  const { question, pack } = askPromptParts({ prompt: request.prompt });
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
