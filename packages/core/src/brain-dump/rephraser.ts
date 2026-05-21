import type { IdeaBacklogId, ProviderId, WorkspaceId } from '@goodboy/types';
import { PROVIDER_CAPABILITIES } from '../providers/capabilities';

function getCheapModel(providerId: ProviderId): string {
  const caps = PROVIDER_CAPABILITIES[providerId];
  return caps.models.find((m) => m.tier === 'cheap')?.id ?? caps.models[0]!.id;
}

function getDefaultBinary(providerId: ProviderId): string {
  switch (providerId) {
    case 'anthropic':
      return 'claude';
    case 'cursor':
      return 'cursor-agent';
    case 'codex':
      return 'codex';
    default: {
      const _exhaustive: never = providerId;
      throw new Error(`unknown provider: ${_exhaustive}`);
    }
  }
}

export type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

interface CliResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
}

export class BrainDumpSpawnError extends Error {
  constructor(
    public readonly exitCode: number | null,
    public readonly stderr: string,
  ) {
    super(`brain-dump cli exited with code ${exitCode ?? 'null'}`);
    this.name = 'BrainDumpSpawnError';
  }
}

export class BrainDumpParseError extends Error {
  constructor(
    message: string,
    public readonly raw: string,
  ) {
    super(message);
    this.name = 'BrainDumpParseError';
  }
}

export interface WorkspaceContext {
  readonly id: WorkspaceId;
  readonly name: string;
  readonly description?: string;
}

export interface RephraseInput {
  readonly rawText: string;
  readonly currentWorkspaceId: WorkspaceId;
  readonly workspaces: ReadonlyArray<WorkspaceContext>;
}

export interface RephraseOutput {
  readonly title: string;
  readonly body: string;
  readonly suggestedWorkspaceId: WorkspaceId | null;
}

export interface RephraserDeps {
  readonly providerId: ProviderId;
  readonly binary?: string;
  readonly invokeFn: InvokeFn;
}

const SYSTEM_PROMPT = `You take a raw user thought (one line or one paragraph) and rephrase it into a structured idea card for a project backlog.

OUTPUT
Respond with one JSON object and nothing else. No prose, no markdown wrapper, no fences. Schema:
{ "title": "<<=60 chars, short imperative phrase>", "body": "<one sentence, no markdown>", "suggestedWorkspaceId": "<id or null>" }

RULES
- title is at most 60 characters, imperative voice ("fix flaky test" not "fixing flaky tests").
- body is one sentence, no markdown, no bullets, no quotes around the whole thing.
- If the raw text clearly belongs in a workspace from the list provided, set suggestedWorkspaceId to that workspace's id. Otherwise return null.
- Never invent a workspace id that is not in the list.
- Always rewrite — even well-formed input — to enforce the canonical shape.`;

export class Rephraser {
  private readonly providerId: ProviderId;
  private readonly binary: string;
  private readonly model: string;
  private readonly invokeFn: InvokeFn;

  constructor(deps: RephraserDeps) {
    this.providerId = deps.providerId;
    this.binary = deps.binary ?? getDefaultBinary(deps.providerId);
    this.model = getCheapModel(deps.providerId);
    this.invokeFn = deps.invokeFn;
  }

  async rephrase(input: RephraseInput): Promise<RephraseOutput> {
    const userMessage = buildUserPrompt(input);
    const result = await this.invokeFn<CliResult>('summarize_session', {
      args: {
        providerId: this.providerId,
        model: this.model,
        binary: this.binary,
        userMessage,
        systemPrompt: SYSTEM_PROMPT,
      },
    });
    if ((result.exitCode ?? 0) !== 0) {
      throw new BrainDumpSpawnError(result.exitCode, result.stderr);
    }
    const text = extractCliText(this.providerId, result.stdout);
    const validIds = new Set(input.workspaces.map((w) => w.id));
    return parseRephraseOutput(text, validIds);
  }
}

function buildUserPrompt(input: RephraseInput): string {
  const wsLines = input.workspaces
    .map((w) => `- ${w.id} :: ${w.name}${w.description ? ` — ${w.description}` : ''}`)
    .join('\n');
  return [
    `Current workspace id: ${input.currentWorkspaceId}`,
    'Available workspaces:',
    wsLines || '(none other)',
    '',
    'Raw thought to rephrase:',
    input.rawText,
    '',
    'Return the JSON object now.',
  ].join('\n');
}

function parseRephraseOutput(raw: string, validWorkspaceIds: ReadonlySet<string>): RephraseOutput {
  const stripped = extractJson(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch (err) {
    throw new BrainDumpParseError(
      `rephrase response was not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      raw,
    );
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new BrainDumpParseError('rephrase response was not a JSON object', raw);
  }
  const obj = parsed as Record<string, unknown>;
  const title = typeof obj.title === 'string' ? obj.title.trim() : '';
  const body = typeof obj.body === 'string' ? obj.body.trim() : '';
  if (title.length === 0) {
    throw new BrainDumpParseError('rephrase response missing "title"', raw);
  }
  if (body.length === 0) {
    throw new BrainDumpParseError('rephrase response missing "body"', raw);
  }
  const rawSuggested = obj.suggestedWorkspaceId;
  let suggestedWorkspaceId: WorkspaceId | null = null;
  if (typeof rawSuggested === 'string' && validWorkspaceIds.has(rawSuggested)) {
    suggestedWorkspaceId = rawSuggested as WorkspaceId;
  }
  return { title: title.slice(0, 80), body, suggestedWorkspaceId };
}

interface ClaudeJsonResult {
  readonly result?: string;
}

export function extractCliText(providerId: ProviderId, stdout: string): string {
  if (providerId !== 'anthropic') return stdout.trim();
  const trimmed = stdout.trim();
  try {
    const parsed = JSON.parse(trimmed) as ClaudeJsonResult;
    return parsed.result?.trim() ?? trimmed;
  } catch {
    return trimmed;
  }
}

export function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const edgeFence = /^```(?:json)?\s*([\s\S]*?)\s*```\s*$/i.exec(trimmed);
  if (edgeFence?.[1]) return edgeFence[1].trim();
  const innerFence = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(trimmed);
  if (innerFence?.[1]) return innerFence[1].trim();
  const balanced = extractBalancedJsonObject(trimmed);
  if (balanced !== null) return balanced;
  return trimmed;
}

function extractBalancedJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

export type { IdeaBacklogId };
