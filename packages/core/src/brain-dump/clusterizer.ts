import type { IdeaBacklogId, ProviderId } from '@goodboy/types';
import { PROVIDER_CAPABILITIES } from '../providers/capabilities';
import {
  BrainDumpParseError,
  BrainDumpSpawnError,
  extractCliText,
  extractJson,
  type InvokeFn,
} from './rephraser';

function getStandardModel(providerId: ProviderId): string {
  const caps = PROVIDER_CAPABILITIES[providerId];
  return caps.models.find((m) => m.tier === 'standard')?.id ?? caps.models[0]!.id;
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

interface CliResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
}

export interface ClusterIdeaInput {
  readonly id: IdeaBacklogId;
  readonly title: string;
  readonly body: string;
}

export interface ClusterizeInput {
  readonly ideas: ReadonlyArray<ClusterIdeaInput>;
}

export interface IdeaCluster {
  readonly id: string;
  readonly name: string;
  readonly itemIds: ReadonlyArray<IdeaBacklogId>;
}

export interface ClusterizeOutput {
  readonly clusters: ReadonlyArray<IdeaCluster>;
}

export interface ClusterizerDeps {
  readonly providerId: ProviderId;
  readonly binary?: string;
  readonly invokeFn: InvokeFn;
}

const SYSTEM_PROMPT = `You take a list of small idea cards and group together the ones that share a goal, scope, or theme. Output is consumed by a UI that lets a human spawn one work session per cluster.

OUTPUT
Respond with one JSON object and nothing else. Schema:
{ "clusters": [ { "name": "<short noun phrase>", "itemIds": ["<id1>", "<id2>", ...] } ] }

RULES
- Each cluster name is a short noun phrase (under 50 chars). No verbs.
- Each itemIds entry MUST be one of the ids you were given verbatim. Never invent ids.
- Every id appears in at most one cluster. Standalone items (no clear cluster mate) form a cluster of one.
- Order clusters from most-related (largest, tightest themes) to least.
- 2–6 ideas per cluster is the sweet spot; longer clusters should be split when the theme is loose.
- If the input has fewer than 2 ideas, return { "clusters": [] }.`;

export class Clusterizer {
  private readonly providerId: ProviderId;
  private readonly binary: string;
  private readonly model: string;
  private readonly invokeFn: InvokeFn;

  constructor(deps: ClusterizerDeps) {
    this.providerId = deps.providerId;
    this.binary = deps.binary ?? getDefaultBinary(deps.providerId);
    this.model = getStandardModel(deps.providerId);
    this.invokeFn = deps.invokeFn;
  }

  async clusterize(input: ClusterizeInput): Promise<ClusterizeOutput> {
    if (input.ideas.length < 2) return { clusters: [] };
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
    const validIds = new Set<string>(input.ideas.map((i) => i.id));
    return parseClusterizeOutput(text, validIds);
  }
}

function buildUserPrompt(input: ClusterizeInput): string {
  const lines = input.ideas.map((i) => `- ${i.id} :: ${i.title} — ${i.body}`).join('\n');
  return [
    `Ideas to cluster (${input.ideas.length}):`,
    lines,
    '',
    'Return the JSON object now.',
  ].join('\n');
}

function parseClusterizeOutput(raw: string, validIds: ReadonlySet<string>): ClusterizeOutput {
  const stripped = extractJson(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch (err) {
    throw new BrainDumpParseError(
      `clusterize response was not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      raw,
    );
  }
  if (typeof parsed !== 'object' || parsed === null || !('clusters' in parsed)) {
    throw new BrainDumpParseError('clusterize response missing "clusters" array', raw);
  }
  const arr = (parsed as { clusters: unknown }).clusters;
  if (!Array.isArray(arr)) {
    throw new BrainDumpParseError('clusterize "clusters" was not an array', raw);
  }
  const claimed = new Set<string>();
  const out: IdeaCluster[] = [];
  for (const entry of arr) {
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as Record<string, unknown>;
    const name = typeof e.name === 'string' ? e.name.trim() : '';
    const ids = Array.isArray(e.itemIds) ? e.itemIds : [];
    if (name.length === 0) continue;
    const kept: IdeaBacklogId[] = [];
    for (const id of ids) {
      if (typeof id !== 'string') continue;
      if (!validIds.has(id)) continue;
      if (claimed.has(id)) continue;
      claimed.add(id);
      kept.push(id as IdeaBacklogId);
    }
    if (kept.length === 0) continue;
    out.push({ id: crypto.randomUUID(), name: name.slice(0, 80), itemIds: kept });
  }
  return { clusters: out };
}
