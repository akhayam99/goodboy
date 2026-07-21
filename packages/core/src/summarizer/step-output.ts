import {
  getCheapModel,
  getDefaultBinary,
  SummarizerParseError,
  SummarizerSpawnError,
  type SummarizerDeps,
} from './client';

const MAX_SUMMARY_LENGTH = 1200;
const MAX_FIRST_LINE_LENGTH = 120;
const FALLBACK_HEAD_LENGTH = 1500;
const FALLBACK_TAIL_LENGTH = 400;

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

type OneShotResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
};

export const summarizeStepOutput = async ({
  providerId,
  binary,
  invokeFn,
  output,
}: Params & SummarizerDeps): Promise<string> => {
  const result = await invokeFn<OneShotResult>('summarize_session', {
    args: {
      providerId,
      model: getCheapModel(providerId),
      binary: binary ?? getDefaultBinary(providerId),
      userMessage: output,
      systemPrompt: STEP_OUTPUT_SYSTEM_PROMPT,
    },
  });
  if ((result.exitCode ?? 0) !== 0) {
    throw new SummarizerSpawnError(result.exitCode, result.stderr);
  }

  const stdout = result.stdout.trim();
  let summary = stdout;
  if (providerId === 'anthropic') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      throw new SummarizerParseError(
        'step output summary response was not valid JSON',
        result.stdout,
      );
    }
    if (typeof parsed !== 'object' || parsed === null || !('result' in parsed)) {
      throw new SummarizerParseError(
        'step output summary response was missing result',
        result.stdout,
      );
    }
    if (typeof parsed.result !== 'string') {
      throw new SummarizerParseError('step output summary result was not text', result.stdout);
    }
    summary = parsed.result.trim();
  }
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
  return `${output.slice(0, FALLBACK_HEAD_LENGTH)}\n...\n${output.slice(-FALLBACK_TAIL_LENGTH)}`;
};
