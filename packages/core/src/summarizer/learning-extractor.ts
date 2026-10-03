import type { EffortLevel, ProviderId } from '@goodboy/types';
import { extractAuxOutput } from '../providers/aux-output';
import { runAuxOneShot } from '../providers/aux-spawn';
import { computeProviderCostUsd } from '../providers/provider-cost';
import { getCheapModel, getDefaultBinary } from '../providers/cli-defaults';
import { cliModelId } from '../providers/cliModelId';
import { extractJson } from './extract-json';
import type { SummarizerUsage } from './client';

export type LearningCandidate = Readonly<{
  topic: string;
  title: string;
  text: string;
}>;

export type LearningExtractionInput = Readonly<{
  topics: ReadonlyArray<string>;
  turnInput: string;
  turnOutput: string;
}>;

export type LearningExtractionResult = Readonly<{
  items: ReadonlyArray<LearningCandidate>;
  usage: SummarizerUsage;
  model: string;
}>;

type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

export type LearningExtractorDeps = Readonly<{
  providerId: ProviderId;
  binary?: string;
  model?: string;
  effort?: EffortLevel;
  workingDir?: string;
  invokeFn: InvokeFn;
}>;

export class LearningExtractorError extends Error {
  constructor(
    message: string,
    public readonly raw: string,
  ) {
    super(message);
    this.name = 'LearningExtractorError';
  }
}

const ITEM_LIMIT = 3;
const TITLE_LIMIT = 90;

const SYSTEM_PROMPT = `Extract explanations written for the person using this coding session.

You receive the topics they asked to learn more about, then one or more turns of an AI coding agent: what it was asked and what it answered.

Return an item only when the agent concretely explained something about one of the topics while doing this work: why the code behaves a certain way, why an approach was chosen, what a concept means in this code. A topic word appearing, or work done in that area without an explanation, is not enough. Keep each explanation grounded in what the turn says. Never add general advice and never infer facts the turn does not state.

Answer with ONE JSON object and nothing else:
{"items": [{"topic": string, "title": string, "text": string}]}

- "topic": one of the supplied topics, spelled exactly as supplied.
- "title": what was explained, as a short specific phrase, at most 90 characters, for example "Why the borrow checker rejects holding the queue across an await".
- "text": the explanation in two to four plain sentences.

At most 3 items. Write in the language of the turn. Return {"items": []} when no topic received a concrete explanation.

No markdown, no code fences, no preamble. Output only the JSON object.`;

const userPrompt = ({ topics, turnInput, turnOutput }: LearningExtractionInput): string =>
  [
    `Topics: ${topics.join(', ')}`,
    '',
    'What the agent was asked:',
    turnInput,
    '',
    'What the agent answered:',
    turnOutput,
  ].join('\n');

type ParseParams = {
  readonly raw: string;
  readonly topics: ReadonlyArray<string>;
};

const parseItems = ({ raw }: { readonly raw: string }): ReadonlyArray<unknown> => {
  const parsed: unknown = (() => {
    try {
      return JSON.parse(extractJson({ raw }));
    } catch (error) {
      throw new LearningExtractorError(
        `learning response was not valid JSON: ${error instanceof Error ? error.message : 'unknown parse error'}`,
        raw,
      );
    }
  })();
  if (typeof parsed !== 'object' || parsed === null || !('items' in parsed)) {
    throw new LearningExtractorError('learning response missing "items" array', raw);
  }
  const { items } = parsed;
  if (!Array.isArray(items)) {
    throw new LearningExtractorError('learning response "items" was not an array', raw);
  }
  return items;
};

type CandidateParams = {
  readonly item: unknown;
  readonly topicByKey: ReadonlyMap<string, string>;
};

const toCandidate = ({ item, topicByKey }: CandidateParams): LearningCandidate | null => {
  if (typeof item !== 'object' || item === null) {
    return null;
  }
  const { topic, title, text } = item as Record<string, unknown>;
  if (typeof topic !== 'string' || typeof title !== 'string' || typeof text !== 'string') {
    return null;
  }
  const known = topicByKey.get(topic.trim().toLocaleLowerCase());
  const cleanTitle = title.trim().slice(0, TITLE_LIMIT);
  const cleanText = text.trim();
  if (known === undefined || cleanTitle === '' || cleanText === '') {
    return null;
  }
  return { topic: known, title: cleanTitle, text: cleanText };
};

export const parseLearningCandidates = ({
  raw,
  topics,
}: ParseParams): ReadonlyArray<LearningCandidate> => {
  const topicByKey = new Map(topics.map((topic) => [topic.trim().toLocaleLowerCase(), topic]));
  const seen = new Set<string>();
  return parseItems({ raw })
    .flatMap((item) => {
      const candidate = toCandidate({ item, topicByKey });
      if (candidate === null) {
        return [];
      }
      const key = `${candidate.topic}\n${candidate.title.toLocaleLowerCase()}`;
      if (seen.has(key)) {
        return [];
      }
      seen.add(key);
      return [candidate];
    })
    .slice(0, ITEM_LIMIT);
};

export class LearningExtractor {
  private readonly providerId: ProviderId;
  private readonly binary: string;
  private readonly model: string;
  private readonly effort: EffortLevel | undefined;
  private readonly workingDir: string | undefined;
  private readonly invokeFn: InvokeFn;

  constructor(deps: LearningExtractorDeps) {
    this.providerId = deps.providerId;
    this.binary = deps.binary ?? getDefaultBinary(deps.providerId);
    this.model = cliModelId({
      provider: deps.providerId,
      model: deps.model ?? getCheapModel(deps.providerId),
    });
    this.effort = deps.effort;
    this.workingDir = deps.workingDir;
    this.invokeFn = deps.invokeFn;
  }

  async extract(input: LearningExtractionInput): Promise<LearningExtractionResult> {
    const result = await runAuxOneShot({
      providerId: this.providerId,
      model: this.model,
      binary: this.binary,
      userMessage: userPrompt(input),
      systemPrompt: SYSTEM_PROMPT,
      ...(this.effort != null && { effort: this.effort }),
      ...(this.workingDir != null && { workingDir: this.workingDir }),
      invokeFn: this.invokeFn,
    });
    if ((result.exitCode ?? 0) !== 0) {
      throw new LearningExtractorError(
        `learning cli exited with code ${result.exitCode ?? 'null'}`,
        result.stderr,
      );
    }
    const output = extractAuxOutput({ providerId: this.providerId, stdout: result.stdout });
    if (output.isError) {
      throw new LearningExtractorError(
        output.errorMessage ?? 'learning cli reported an error',
        result.stdout,
      );
    }
    const usage: SummarizerUsage = {
      ...output.usage,
      estimatedCostUsd: computeProviderCostUsd({
        providerId: this.providerId,
        usage: { ...output.usage, estimatedCostUsd: output.usage.estimatedCostUsd ?? 0 },
        model: this.model,
      }),
    };
    return {
      items: parseLearningCandidates({ raw: output.text, topics: input.topics }),
      usage,
      model: this.model,
    };
  }
}
