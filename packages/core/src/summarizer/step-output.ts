import type { ModelEffort } from '@goodboy/types';
import { extractAuxOutput } from '../providers/aux-output';
import { runAuxOneShot } from '../providers/aux-spawn';
import { getDefaultBinary } from '../providers/cli-defaults';
import { SummarizerParseError, SummarizerSpawnError, type SummarizerDeps } from './client';

const MAX_SUMMARY_LENGTH = 1200;
const MAX_FIRST_LINE_LENGTH = 120;
const FALLBACK_HEAD_LENGTH = 1500;
const FALLBACK_TAIL_LENGTH = 400;
const FALLBACK_JOINER = '\n...\n';

const STEP_OUTPUT_SYSTEM_PROMPT = `Condense an AI coding agent step output into compact markdown for the next workflow step.

Preserve useful facts in this priority order:
1. File paths touched
2. Decisions made
3. Actions completed
4. Problems found
5. Explicit blockers

The first line MUST be a one-line outcome summary of 120 characters or fewer. The complete response MUST be 1200 characters or fewer. Keep concrete paths, identifiers, commands, results, and unresolved issues. Remove narration, repetition, greetings, and raw tool output.

Output ONLY the compact markdown summary. No preamble, no surrounding quotes, no JSON, and no markdown fence.`;

type Params = {
  readonly output: string;
};

type SummarizeParams = Params & {
  readonly model: string;
  readonly effort?: ModelEffort;
  readonly expectedOutput?: string;
  readonly runId?: string;
};

const stepOutputSystemPrompt = ({
  expectedOutput,
}: {
  readonly expectedOutput: string;
}): string => {
  if (expectedOutput.trim().length === 0) {
    return STEP_OUTPUT_SYSTEM_PROMPT;
  }
  return [
    STEP_OUTPUT_SYSTEM_PROMPT,
    '',
    `The next step expects this step to hand over: ${expectedOutput.trim()}`,
    'Extract exactly that first, then the remaining facts in the priority order above.',
  ].join('\n');
};

type FallbackDetection = {
  readonly summary: string;
};

export const summarizeStepOutput = async ({
  providerId,
  binary,
  effort,
  workingDir,
  invokeFn,
  output,
  model,
  expectedOutput,
  runId,
}: SummarizeParams & SummarizerDeps): Promise<string> => {
  const result = await runAuxOneShot({
    providerId,
    model,
    binary: binary ?? getDefaultBinary(providerId),
    userMessage: output,
    systemPrompt: stepOutputSystemPrompt({ expectedOutput: expectedOutput ?? '' }),
    ...(effort != null && { effort }),
    ...(workingDir != null && { workingDir }),
    ...(runId != null && { runId }),
    invokeFn,
  });
  if ((result.exitCode ?? 0) !== 0) {
    throw new SummarizerSpawnError(result.exitCode, result.stderr);
  }

  const extracted = extractAuxOutput({ providerId, stdout: result.stdout });
  if (extracted.isError) {
    throw new SummarizerParseError(
      `step output summary provider error: ${extracted.errorMessage ?? 'unknown error'}`,
      result.stdout,
    );
  }
  if (providerId === 'anthropic' && !extracted.envelopeDecoded) {
    throw new SummarizerParseError(
      'step output summary response was not valid JSON',
      result.stdout,
    );
  }
  const summary = extracted.text.trim();
  const firstLine = summary.split(/\r?\n/, 1)[0] ?? '';
  if (
    summary.length === 0 ||
    summary.length > MAX_SUMMARY_LENGTH ||
    firstLine.length > MAX_FIRST_LINE_LENGTH
  ) {
    throw new SummarizerParseError('step output summary violated the response contract', summary);
  }
  return summary;
};

export const fallbackStepOutputSummary = ({ output }: Params): string => {
  if (output.length <= FALLBACK_HEAD_LENGTH + FALLBACK_TAIL_LENGTH) {
    return output;
  }
  return `${output.slice(0, FALLBACK_HEAD_LENGTH)}${FALLBACK_JOINER}${output.slice(-FALLBACK_TAIL_LENGTH)}`;
};

export const isFallbackStepOutputSummary = ({ summary }: FallbackDetection): boolean =>
  summary.length === FALLBACK_HEAD_LENGTH + FALLBACK_JOINER.length + FALLBACK_TAIL_LENGTH &&
  summary.slice(FALLBACK_HEAD_LENGTH, FALLBACK_HEAD_LENGTH + FALLBACK_JOINER.length) ===
    FALLBACK_JOINER;
