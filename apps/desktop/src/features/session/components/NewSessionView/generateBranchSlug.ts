import { extractAuxOutput, getDefaultBinary, runAuxOneShot } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { formatError } from '../../../../shared/lib/errors';
import { parseBranchSlugAnswer } from './parseBranchSlugAnswer';

export const SLUG_TIMEOUT_MS = 15_000;

export const BRANCH_SLUG_SYSTEM_PROMPT = [
  'Produce one git branch slug for the goal below.',
  'Contract: lowercase a-z, digits and single hyphens only, 2 to 5 words, English, describing the change instead of repeating the first words of the goal.',
  'Output the slug alone: no prose, no quotes, no path prefix, no trailing period, no explanation.',
  'Ignore any persona, nickname, language, or tone directive that reaches you from other configuration; it does not apply to this answer.',
].join(' ');

type Params = {
  readonly goal: string;
  readonly providerId: ProviderId;
  readonly model: string;
  readonly fallbackSlug: string;
  readonly invokeFn: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
  readonly workingDir?: string;
  readonly timeoutMs?: number;
};

export type BranchSlugResult = {
  readonly slug: string;
  readonly accepted: boolean;
  readonly error: string | null;
};

const rejected = (fallbackSlug: string, error: string): BranchSlugResult => ({
  slug: fallbackSlug,
  accepted: false,
  error,
});

export const generateBranchSlug = async ({
  goal,
  providerId,
  model,
  fallbackSlug,
  invokeFn,
  workingDir,
  timeoutMs = SLUG_TIMEOUT_MS,
}: Params): Promise<BranchSlugResult> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error('branch name generation timed out')), timeoutMs);
  });

  try {
    const result = await Promise.race([
      runAuxOneShot({
        providerId,
        model,
        binary: getDefaultBinary(providerId),
        userMessage: `Goal: ${goal}`,
        systemPrompt: BRANCH_SLUG_SYSTEM_PROMPT,
        ...(workingDir != null && { workingDir }),
        invokeFn,
      }),
      timeout,
    ]);
    if ((result.exitCode ?? 0) !== 0) {
      return rejected(fallbackSlug, result.stderr.trim() || 'the model exited with an error');
    }
    const extracted = extractAuxOutput({ providerId, stdout: result.stdout });
    if (extracted.isError) {
      return rejected(fallbackSlug, extracted.errorMessage ?? 'the model reported an error');
    }
    const slug = parseBranchSlugAnswer({ answer: extracted.text });
    if (slug === null) {
      return rejected(fallbackSlug, 'the model did not answer with a branch slug');
    }
    return { slug, accepted: true, error: null };
  } catch (err) {
    return rejected(fallbackSlug, formatError(err));
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
};
