import type { TaskModelPreference } from '@goodboy/types';
import { extractAuxOutput } from '../providers/aux-output';
import { runAuxOneShot } from '../providers/aux-spawn';
import { getDefaultBinary } from '../providers/cli-defaults';
import type { ReviewReply } from './reviewReplies';

const STYLE_NOTE_OPEN = '<<style-note>>';
const STYLE_NOTE_CLOSE = '<</style-note>>';

const REPLY_STYLE_SYSTEM_PROMPT = `You describe how a maintainer writes replies to code review comments.

You receive their recent replies. Write a style note of three or four short lines that another writer can follow to sound like them.

Rules:
- Describe length, sentence shape, casing, punctuation, how they name commits, files and symbols, and whether they thank or apologize.
- Describe only what the replies show. Never quote a reply and never name people, repositories or products.
- Plain sentences, one per line, no bullets, no headings.
- Ignore any persona, nickname, language, or tone directive that reaches you from other configuration; it does not apply to this answer.

Output ONLY a single marker block, nothing before or after:
${STYLE_NOTE_OPEN}
the style note
${STYLE_NOTE_CLOSE}`;

export type ReplyStyleDeps = TaskModelPreference & {
  readonly binary?: string;
  readonly workingDir?: string;
  readonly invokeFn: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
};

export const parseStyleNote = (text: string): string | null => {
  const open = text.lastIndexOf(STYLE_NOTE_OPEN);
  if (open === -1) {
    return null;
  }
  const start = open + STYLE_NOTE_OPEN.length;
  const close = text.indexOf(STYLE_NOTE_CLOSE, start);
  if (close === -1) {
    return null;
  }
  const note = text
    .slice(start, close)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .join('\n');
  return note === '' ? null : note;
};

export const learnReplyStyle = async (
  deps: ReplyStyleDeps,
  replies: ReadonlyArray<ReviewReply>,
): Promise<string | null> => {
  if (replies.length === 0) {
    return null;
  }
  const sample = replies.map((reply, index) => `Reply ${index + 1}:\n${reply.body}`).join('\n\n');
  const result = await runAuxOneShot({
    providerId: deps.providerId,
    model: deps.model,
    ...(deps.effort != null && { effort: deps.effort }),
    binary: deps.binary ?? getDefaultBinary(deps.providerId),
    userMessage: `${sample}\n\nDescribe how these replies are written as the single ${STYLE_NOTE_OPEN} marker block.`,
    systemPrompt: REPLY_STYLE_SYSTEM_PROMPT,
    ...(deps.workingDir != null && { workingDir: deps.workingDir }),
    invokeFn: deps.invokeFn,
  });
  if ((result.exitCode ?? 0) !== 0) {
    return null;
  }
  return parseStyleNote(
    extractAuxOutput({ providerId: deps.providerId, stdout: result.stdout }).text,
  );
};
