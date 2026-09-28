import type { ChatMessage, ChatSummary } from '@goodboy/types';
import type { ChatBackend } from './chatBackend';
import { draftWorkBrief, parseWorkBrief, type WorkBrief } from './workBrief';

const HISTORY_LIMIT = 12;
const HISTORY_CHARS = 12_000;
const SUMMARY_TIMEOUT_MS = 45_000;

type Params = {
  readonly backend: Pick<ChatBackend, 'summarizeForWork'>;
  readonly chat: Pick<ChatSummary, 'title' | 'provider' | 'model'>;
  readonly messages: ReadonlyArray<ChatMessage>;
  readonly projectNames: ReadonlyArray<string>;
};

type ProjectsParams = Pick<Params, 'projectNames'>;

export const workBriefSystemPrompt = ({ projectNames }: ProjectsParams): string =>
  [
    'You turn a conversation about a code workspace into a brief for a coding agent.',
    'Reply with one JSON object and nothing else, with these keys:',
    '"title": a short imperative title, under 70 characters.',
    '"goal": two or three plain sentences: what to change and why.',
    '"know": up to three short facts the chat established.',
    '"files": up to four project-relative paths the chat named, with a line number when it gave one.',
    `"project": the one project the work belongs to, one of: ${projectNames.join(', ')}.`,
  ].join('\n');

type TranscriptParams = Pick<Params, 'messages'>;

const transcriptOf = ({ messages }: TranscriptParams): string => {
  const lines = messages
    .slice(-HISTORY_LIMIT)
    .filter((message) => message.content.trim() !== '')
    .map((message) => `${message.role === 'user' ? 'Question' : 'Answer'}:\n${message.content}`);
  return lines.join('\n\n').slice(-HISTORY_CHARS);
};

type TimeoutParams<T> = {
  readonly promise: Promise<T>;
};

const withTimeout = <T>({ promise }: TimeoutParams<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('The summary took too long')),
      SUMMARY_TIMEOUT_MS,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

export const summarizeChatForWork = async ({
  backend,
  chat,
  messages,
  projectNames,
}: Params): Promise<WorkBrief> => {
  const fallback = draftWorkBrief({ title: chat.title, messages, projectNames });
  try {
    const text = await withTimeout({
      promise: backend.summarizeForWork({
        provider: chat.provider,
        model: chat.model,
        systemPrompt: workBriefSystemPrompt({ projectNames }),
        userMessage: transcriptOf({ messages }),
      }),
    });
    return parseWorkBrief({ text, fallback, projectNames });
  } catch {
    return fallback;
  }
};
