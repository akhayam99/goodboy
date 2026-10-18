import type { TaskModelPreference } from '@goodboy/types';
import { unwrapEdgeFence } from '../code-fence';
import { extractAuxOutput } from '../providers/aux-output';
import { runAuxOneShot } from '../providers/aux-spawn';
import { getDefaultBinary } from '../providers/cli-defaults';
import { computeProviderCostUsd } from '../providers/provider-cost';

export const CLASSIFIED_ROLES = ['scout', 'planner', 'investigator', 'reviewer'] as const;

export type ClassifiedRole = (typeof CLASSIFIED_ROLES)[number];

export type RequestDifficulty = 'light' | 'standard' | 'heavy';

export type RequestClassification = {
  readonly role: ClassifiedRole | null;
  readonly difficulty: RequestDifficulty;
};

export type RequestClassifierFailure = 'provider_failed' | 'empty_answer' | 'not_json';

export type RequestClassifierResult =
  | {
      readonly kind: 'ready';
      readonly classification: RequestClassification;
      readonly durationMs: number;
      readonly costUsd: number;
    }
  | {
      readonly kind: 'failed';
      readonly failure: RequestClassifierFailure;
      readonly detail: string | null;
    };

export type RequestClassifierDeps = TaskModelPreference & {
  readonly binary?: string;
  readonly workingDir?: string;
  readonly invokeFn: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
  readonly nowMs?: () => number;
};

const REQUEST_CLASSIFIER_SYSTEM_PROMPT = `You read the first request a person typed to an AI coding assistant and say which kind of agent should start on it.

Answer with ONE JSON object and nothing else, with exactly these keys:
{"role": "scout" | "planner" | "investigator" | "reviewer" | "none", "difficulty": "light" | "standard" | "heavy"}

- "scout": the request asks where something is in the code or how it works today.
- "planner": the request asks for a plan, a design or the steps of a change, before anything changes.
- "investigator": the request asks why something fails, crashes or gives a wrong result.
- "reviewer": the request asks to judge a change that already exists.
- "none": anything else, a question, a change to make, a vague request, or when you are not sure. When in doubt, answer none.
- "difficulty": how hard the work is. "light" for one small, local thing, "heavy" for work that spans many files or needs careful design, "standard" otherwise.

No markdown, no code fences, no preamble, no explanation. Output only the JSON object.`;

type TextParams = {
  readonly text: string;
};

export const buildRequestClassifierUserPrompt = ({ text }: TextParams): string =>
  [
    'REQUEST:',
    text.trim(),
    '',
    'Classify the request following your instructions. Output only the JSON object.',
  ].join('\n');

type ParseResult =
  | { readonly kind: 'ready'; readonly classification: RequestClassification }
  | { readonly kind: 'failed'; readonly failure: RequestClassifierFailure };

const roleOf = (value: unknown): ClassifiedRole | null =>
  CLASSIFIED_ROLES.find((role) => role === value) ?? null;

const difficultyOf = (value: unknown): RequestDifficulty => {
  if (value === 'light' || value === 'heavy') {
    return value;
  }
  return 'standard';
};

export const parseRequestClassification = ({ text }: TextParams): ParseResult => {
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
  const record: Record<string, unknown> = { ...parsed };
  return {
    kind: 'ready',
    classification: {
      role: roleOf(record['role']),
      difficulty: difficultyOf(record['difficulty']),
    },
  };
};

type ClassifyParams = {
  readonly deps: RequestClassifierDeps;
  readonly text: string;
};

export const classifyRequest = async ({
  deps,
  text,
}: ClassifyParams): Promise<RequestClassifierResult> => {
  const now = deps.nowMs ?? Date.now;
  const startedAt = now();
  let result: Awaited<ReturnType<typeof runAuxOneShot>>;
  try {
    result = await runAuxOneShot({
      providerId: deps.providerId,
      model: deps.model,
      ...(deps.effort != null && { effort: deps.effort }),
      binary: deps.binary ?? getDefaultBinary(deps.providerId),
      userMessage: buildRequestClassifierUserPrompt({ text }),
      systemPrompt: REQUEST_CLASSIFIER_SYSTEM_PROMPT,
      ...(deps.workingDir != null && { workingDir: deps.workingDir }),
      invokeFn: deps.invokeFn,
    });
  } catch (cause) {
    return {
      kind: 'failed',
      failure: 'provider_failed',
      detail: cause instanceof Error ? cause.message : null,
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
  const parsed = parseRequestClassification({ text: output.text });
  if (parsed.kind === 'failed') {
    return { kind: 'failed', failure: parsed.failure, detail: null };
  }
  return {
    kind: 'ready',
    classification: parsed.classification,
    durationMs: Math.max(0, now() - startedAt),
    costUsd: computeProviderCostUsd({
      providerId: deps.providerId,
      usage: { ...output.usage, estimatedCostUsd: output.usage.estimatedCostUsd ?? 0 },
      model: deps.model,
    }),
  };
};
