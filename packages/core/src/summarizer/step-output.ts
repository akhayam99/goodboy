import type { EffortLevel } from '@goodboy/types';
import { extractAuxOutput } from '../providers/aux-output';
import { runAuxOneShot } from '../providers/aux-spawn';
import { getDefaultBinary } from '../providers/cli-defaults';
import { computeProviderCostUsd } from '../providers/provider-cost';
import {
  SummarizerParseError,
  SummarizerSpawnError,
  type SummarizerDeps,
  type SummarizerUsage,
} from './client';

const MAX_SUMMARY_LENGTH = 1200;
const FALLBACK_TOTAL_BUDGET = 4000;
const FALLBACK_HEAD_SHARE = 0.6;
const FALLBACK_BOUNDARY_KEEP_RATIO = 0.7;
const FALLBACK_MARKER_PREFIX = '[unsummarized step output';
const FALLBACK_WHOLE_MARKER = `${FALLBACK_MARKER_PREFIX}, carried whole]`;
const FALLBACK_EXCERPT_MARKER = `${FALLBACK_MARKER_PREFIX}, excerpt]`;
const FALLBACK_EMPTY_MARKER = `${FALLBACK_MARKER_PREFIX}, no output captured]`;
const FALLBACK_LEGACY_MARKER = `${FALLBACK_MARKER_PREFIX}, legacy excerpt]`;
const FALLBACK_GAP_NOTICE = '\n\n[middle dropped, the full text is in the step transcript]\n\n';
const LEGACY_FALLBACK_HEAD_LENGTH = 1500;
const LEGACY_FALLBACK_TAIL_LENGTH = 400;
const LEGACY_FALLBACK_JOINER = '\n...\n';
const SENTENCE_END_CHARS = '.!?';
const MAX_SUMMARIZER_INPUT_LENGTH = 120_000;
const SUMMARIZER_INPUT_HEAD_LENGTH = 100_000;
const SUMMARIZER_INPUT_JOINER =
  '\n\n[middle output omitted to fit the summarizer input budget]\n\n';
const CLAMP_NOTICE =
  '\n\n(clamped to the handoff budget, the full step output is in the step transcript)';

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
  readonly effort?: EffortLevel;
  readonly expectedOutput?: string;
  readonly runId?: string;
  readonly onUsage?: (usage: StepOutputUsage) => Promise<void>;
};

export type StepOutputUsage = SummarizerUsage;

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

type PreviewParams = FallbackDetection & {
  readonly length: number;
};

type TextParams = {
  readonly text: string;
};

type CutParams = TextParams & {
  readonly limit: number;
};

type ClampParams = {
  readonly summary: string;
};

const clampToSummaryBudget = ({ summary }: ClampParams): string => {
  const [outcomeLine = '', ...remainingLines] = summary.split(/\r?\n/);
  const budget = MAX_SUMMARY_LENGTH - CLAMP_NOTICE.length;
  const boundedOutcomeLine = outcomeLine.slice(0, budget);
  const kept = [boundedOutcomeLine];
  let used = boundedOutcomeLine.length;
  for (const line of remainingLines) {
    const grown = used + line.length + 1;
    if (grown > budget) {
      break;
    }
    kept.push(line);
    used = grown;
  }
  return `${kept.join('\n').trimEnd()}${CLAMP_NOTICE}`;
};

const boundSummarizerInput = ({ output }: Params): string => {
  if (output.length <= MAX_SUMMARIZER_INPUT_LENGTH) {
    return output;
  }
  const tailLength =
    MAX_SUMMARIZER_INPUT_LENGTH - SUMMARIZER_INPUT_HEAD_LENGTH - SUMMARIZER_INPUT_JOINER.length;
  return `${output.slice(0, SUMMARIZER_INPUT_HEAD_LENGTH)}${SUMMARIZER_INPUT_JOINER}${output.slice(-tailLength)}`;
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
  invocation,
  onUsage,
}: SummarizeParams & SummarizerDeps): Promise<string> => {
  const result = await runAuxOneShot({
    providerId,
    model,
    binary: binary ?? getDefaultBinary(providerId),
    userMessage: boundSummarizerInput({ output }),
    systemPrompt: stepOutputSystemPrompt({ expectedOutput: expectedOutput ?? '' }),
    ...(effort != null && { effort }),
    ...(workingDir != null && { workingDir }),
    ...(runId != null && { runId }),
    ...(invocation != null && { invocation }),
    invokeFn,
  });
  if ((result.exitCode ?? 0) !== 0) {
    throw new SummarizerSpawnError(result.exitCode, result.stderr);
  }

  const extracted = extractAuxOutput({ providerId, stdout: result.stdout });
  if (onUsage != null) {
    await onUsage({
      ...extracted.usage,
      cachedInputTokens: extracted.usage.cachedInputTokens ?? 0,
      cacheCreationInputTokens: extracted.usage.cacheCreationInputTokens ?? 0,
      estimatedCostUsd: computeProviderCostUsd({
        providerId,
        usage: {
          ...extracted.usage,
          estimatedCostUsd: extracted.usage.estimatedCostUsd ?? 0,
        },
        model,
      }),
      model,
      ...(invocation != null && { invocationId: invocation.invocationId }),
    });
  }
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
  if (summary.length === 0) {
    throw new SummarizerParseError('step output summary violated the response contract', summary);
  }
  if (summary.length > MAX_SUMMARY_LENGTH) {
    return clampToSummaryBudget({ summary });
  }
  return summary;
};

const lastSentenceEnd = ({ text }: TextParams): number => {
  let found = -1;
  for (let index = 0; index < text.length; index += 1) {
    if (!SENTENCE_END_CHARS.includes(text[index] ?? '')) {
      continue;
    }
    const next = text[index + 1];
    if (next === undefined || /\s/.test(next)) {
      found = index + 1;
    }
  }
  return found;
};

const firstSentenceEnd = ({ text }: TextParams): number => {
  for (let index = 0; index < text.length; index += 1) {
    if (!SENTENCE_END_CHARS.includes(text[index] ?? '')) {
      continue;
    }
    const next = text[index + 1];
    if (next === undefined || /\s/.test(next)) {
      return index + 1;
    }
  }
  return -1;
};

const lastWhitespace = ({ text }: TextParams): number => {
  for (let index = text.length - 1; index >= 0; index -= 1) {
    if (/\s/.test(text[index] ?? '')) {
      return index;
    }
  }
  return -1;
};

const firstWhitespace = ({ text }: TextParams): number => {
  for (let index = 0; index < text.length; index += 1) {
    if (/\s/.test(text[index] ?? '')) {
      return index;
    }
  }
  return -1;
};

const headCut = ({ text, limit }: CutParams): string => {
  if (text.length <= limit) {
    return text;
  }
  const window = text.slice(0, limit);
  const floor = Math.floor(limit * FALLBACK_BOUNDARY_KEEP_RATIO);
  const candidates = [
    window.lastIndexOf('\n\n'),
    window.lastIndexOf('\n'),
    lastSentenceEnd({ text: window }),
    lastWhitespace({ text: window }),
  ];
  for (const candidate of candidates) {
    if (candidate >= floor) {
      return window.slice(0, candidate);
    }
  }
  return window;
};

const tailCut = ({ text, limit }: CutParams): string => {
  if (text.length <= limit) {
    return text;
  }
  const window = text.slice(text.length - limit);
  const ceiling = Math.ceil(limit * (1 - FALLBACK_BOUNDARY_KEEP_RATIO));
  const paragraph = window.indexOf('\n\n');
  const line = window.indexOf('\n');
  const sentence = firstSentenceEnd({ text: window });
  const whitespace = firstWhitespace({ text: window });
  const candidates = [
    paragraph < 0 ? -1 : paragraph + 2,
    line < 0 ? -1 : line + 1,
    sentence,
    whitespace < 0 ? -1 : whitespace + 1,
  ];
  for (const candidate of candidates) {
    if (candidate >= 0 && candidate <= ceiling) {
      return window.slice(candidate);
    }
  }
  return window;
};

const isLegacyFallback = ({ summary }: FallbackDetection): boolean =>
  summary.length ===
    LEGACY_FALLBACK_HEAD_LENGTH + LEGACY_FALLBACK_JOINER.length + LEGACY_FALLBACK_TAIL_LENGTH &&
  summary.slice(
    LEGACY_FALLBACK_HEAD_LENGTH,
    LEGACY_FALLBACK_HEAD_LENGTH + LEGACY_FALLBACK_JOINER.length,
  ) === LEGACY_FALLBACK_JOINER;

export const fallbackStepOutputSummary = ({ output }: Params): string => {
  const text = output.trim();
  if (text.length === 0) {
    return FALLBACK_EMPTY_MARKER;
  }
  const wholeAllowance = FALLBACK_TOTAL_BUDGET - FALLBACK_WHOLE_MARKER.length - 1;
  if (text.length <= wholeAllowance) {
    return `${FALLBACK_WHOLE_MARKER}\n${text}`;
  }
  const allowance =
    FALLBACK_TOTAL_BUDGET - FALLBACK_EXCERPT_MARKER.length - 1 - FALLBACK_GAP_NOTICE.length;
  const headLimit = Math.floor(allowance * FALLBACK_HEAD_SHARE);
  const head = headCut({ text, limit: headLimit }).trimEnd();
  const tail = tailCut({ text, limit: allowance - headLimit }).trimStart();
  return `${FALLBACK_EXCERPT_MARKER}\n${head}${FALLBACK_GAP_NOTICE}${tail}`;
};

export const fallbackStepOutputMarker = ({ summary }: FallbackDetection): string | null => {
  const firstLine = summary.split(/\r?\n/, 1)[0] ?? '';
  return firstLine.startsWith(FALLBACK_MARKER_PREFIX) ? firstLine : null;
};

export const isFallbackStepOutputSummary = ({ summary }: FallbackDetection): boolean =>
  fallbackStepOutputMarker({ summary }) !== null || isLegacyFallback({ summary });

export const annotateFallbackStepOutputSummary = ({ summary }: FallbackDetection): string => {
  if (fallbackStepOutputMarker({ summary }) !== null || !isLegacyFallback({ summary })) {
    return summary;
  }
  return `${FALLBACK_LEGACY_MARKER}\n${summary}`;
};

export const previewStepOutputSummary = ({ summary, length }: PreviewParams): string => {
  const annotated = annotateFallbackStepOutputSummary({ summary });
  const marker = fallbackStepOutputMarker({ summary: annotated });
  if (marker === null) {
    return annotated.slice(0, length);
  }
  const room = length - marker.length - 1;
  if (room <= 0) {
    return marker.slice(0, length);
  }
  return `${marker} ${annotated.slice(marker.length).trimStart().slice(0, room)}`;
};
