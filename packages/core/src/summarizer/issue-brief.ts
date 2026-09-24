import type { TaskModelPreference } from '@goodboy/types';
import { extractAuxOutput } from '../providers/aux-output';
import { runAuxOneShot } from '../providers/aux-spawn';
import { getDefaultBinary } from '../providers/cli-defaults';
import { computeProviderCostUsd } from '../providers/provider-cost';

const ISSUE_BRIEF_SYSTEM_PROMPT = `You turn a tracker item (an issue, a ticket, an error report or a chat thread) into the brief for an AI coding session.

You receive the item's identifier, its title and its full text.

Answer with ONE JSON object and nothing else, with exactly these keys:
{"title": string, "goal": string, "acceptance": string[]}

- "title": what the session will do, as a short imperative phrase. At most 60 characters. No identifier, no brackets, no trailing period.
- "goal": the desired end result in one to three plain sentences. Keep the concrete objective, domain names, constraints and identifiers from the item. Drop template noise, images, greetings and reproduction steps that only describe the bug.
- "acceptance": up to 5 short, checkable criteria that tell when the work is done. Use an empty array when the item gives none and none can be derived.

Write the title, the goal and the criteria in the language of the item. If the item is written in Italian, answer in Italian; same for any other language.

No markdown, no code fences, no preamble, no explanation. Output only the JSON object.`;

const ACCEPTANCE_LIMIT = 5;

export type IssueBriefInput = {
  readonly identifier: string;
  readonly title: string;
  readonly body: string;
};

export type IssueBriefDeps = TaskModelPreference & {
  readonly binary?: string;
  readonly workingDir?: string;
  readonly invokeFn: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
  readonly nowMs?: () => number;
};

export type IssueBrief = {
  readonly title: string;
  readonly goal: string;
  readonly acceptance: ReadonlyArray<string>;
};

export type IssueBriefFailure =
  'provider_failed' | 'empty_answer' | 'not_json' | 'missing_title' | 'missing_goal';

export type IssueBriefResult =
  | {
      readonly kind: 'ready';
      readonly brief: IssueBrief;
      readonly durationMs: number;
      readonly costUsd: number;
    }
  | {
      readonly kind: 'failed';
      readonly failure: IssueBriefFailure;
      readonly detail: string | null;
    };

type ParseParams = {
  readonly text: string;
};

type ParseResult =
  | { readonly kind: 'ready'; readonly brief: IssueBrief }
  | { readonly kind: 'failed'; readonly failure: IssueBriefFailure };

export const buildIssueBriefUserPrompt = ({ identifier, title, body }: IssueBriefInput): string => {
  const text = body.trim();
  return [
    `IDENTIFIER: ${identifier.trim()}`,
    `TITLE: ${title.trim()}`,
    '',
    'TEXT:',
    text === '' ? '(no text)' : text,
    '',
    'Write the brief following your instructions. Output only the JSON object.',
  ].join('\n');
};

const FENCE = '```';
const FENCE_LANGUAGE = 'json';

const unwrapEdgeFence = ({ text }: ParseParams): string => {
  if (text.length < FENCE.length * 2 || !text.startsWith(FENCE) || !text.endsWith(FENCE)) {
    return text;
  }
  const inner = text.slice(FENCE.length, -FENCE.length);
  const hasLanguage = inner.slice(0, FENCE_LANGUAGE.length).toLowerCase() === FENCE_LANGUAGE;
  return (hasLanguage ? inner.slice(FENCE_LANGUAGE.length) : inner).trim();
};

const singleLine = ({ text }: ParseParams): string => text.replace(/\s+/g, ' ').trim();

const isProse = ({ text }: ParseParams): boolean => text !== '' && !text.includes('```');

type ReadParams = {
  readonly value: unknown;
};

const readString = ({ value }: ReadParams): string =>
  typeof value === 'string' ? value.trim() : '';

export const parseIssueBrief = ({ text }: ParseParams): ParseResult => {
  const trimmed = text.trim();
  if (trimmed === '') {
    return { kind: 'failed', failure: 'empty_answer' };
  }
  const candidate = unwrapEdgeFence({ text: trimmed });
  if (!candidate.startsWith('{') || !candidate.endsWith('}')) {
    return { kind: 'failed', failure: 'not_json' };
  }
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return { kind: 'failed', failure: 'not_json' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { kind: 'failed', failure: 'not_json' };
  }
  const record = parsed as Record<string, unknown>;
  const title = singleLine({ text: readString({ value: record['title'] }) });
  if (!isProse({ text: title })) {
    return { kind: 'failed', failure: 'missing_title' };
  }
  const goal = readString({ value: record['goal'] });
  if (!isProse({ text: goal })) {
    return { kind: 'failed', failure: 'missing_goal' };
  }
  const rawAcceptance = Array.isArray(record['acceptance']) ? record['acceptance'] : [];
  const acceptance = rawAcceptance
    .map((entry) => singleLine({ text: readString({ value: entry }) }))
    .filter((entry) => isProse({ text: entry }))
    .slice(0, ACCEPTANCE_LIMIT);
  return { kind: 'ready', brief: { title, goal, acceptance } };
};

type GenerateParams = {
  readonly deps: IssueBriefDeps;
  readonly input: IssueBriefInput;
};

export const generateIssueBrief = async ({
  deps,
  input,
}: GenerateParams): Promise<IssueBriefResult> => {
  const now = deps.nowMs ?? Date.now;
  const startedAt = now();
  let result: Awaited<ReturnType<typeof runAuxOneShot>>;
  try {
    result = await runAuxOneShot({
      providerId: deps.providerId,
      model: deps.model,
      ...(deps.effort != null && { effort: deps.effort }),
      binary: deps.binary ?? getDefaultBinary(deps.providerId),
      userMessage: buildIssueBriefUserPrompt(input),
      systemPrompt: ISSUE_BRIEF_SYSTEM_PROMPT,
      ...(deps.workingDir != null && { workingDir: deps.workingDir }),
      invokeFn: deps.invokeFn,
    });
  } catch (cause) {
    return {
      kind: 'failed',
      failure: 'provider_failed',
      detail: cause instanceof Error ? cause.message : String(cause),
    };
  }
  if ((result.exitCode ?? 0) !== 0) {
    const stderr = result.stderr.trim();
    return { kind: 'failed', failure: 'provider_failed', detail: stderr === '' ? null : stderr };
  }
  const output = extractAuxOutput({ providerId: deps.providerId, stdout: result.stdout });
  if (output.isError) {
    return { kind: 'failed', failure: 'provider_failed', detail: output.errorMessage };
  }
  const parsed = parseIssueBrief({ text: output.text });
  if (parsed.kind === 'failed') {
    return { kind: 'failed', failure: parsed.failure, detail: null };
  }
  return {
    kind: 'ready',
    brief: parsed.brief,
    durationMs: Math.max(0, now() - startedAt),
    costUsd: computeProviderCostUsd({
      providerId: deps.providerId,
      usage: { ...output.usage, estimatedCostUsd: output.usage.estimatedCostUsd ?? 0 },
      model: deps.model,
    }),
  };
};
