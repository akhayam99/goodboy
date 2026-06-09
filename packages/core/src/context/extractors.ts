import type { TurnEvent } from '@goodboy/types';
import type { AgentKindLabel } from '../first-turn-classifier';

export const extractFilesTouched = (events: ReadonlyArray<TurnEvent>): ReadonlyArray<string> => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ev of events) {
    if (ev.kind !== 'file_edit') {
      continue;
    }
    if (seen.has(ev.path)) {
      continue;
    }
    seen.add(ev.path);
    out.push(ev.path);
  }
  return out;
};

const DECISION_RE = /<<ctx-decision>>([\s\S]*?)<<\/ctx-decision>>/g;
const QUESTION_RE = /<<ctx-question(?:\s+suggestions="([^"]*)")?>>([\s\S]*?)<<\/ctx-question>>/g;
const RESOLVED_RE = /<<ctx-resolved>>([\s\S]*?)<<\/ctx-resolved>>/g;
const PLAN_RE = /<<plan>>([\s\S]*?)<<\/plan>>/g;
const HANDOFF_RE = /<<handoff\s+([^>]+?)>>/g;
const HANDOFF_ATTR_RE = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;

export type ExtractedQuestion = {
  readonly text: string;
  readonly suggestedAnswers: ReadonlyArray<string>;
};

export const extractMarkers = (
  assistantText: string,
): {
  readonly decisions: ReadonlyArray<string>;
  readonly questions: ReadonlyArray<ExtractedQuestion>;
  readonly resolved: ReadonlyArray<string>;
} => {
  const decisions = extractAll(assistantText, DECISION_RE);
  const questions = extractQuestions(assistantText);
  const resolved = extractAll(assistantText, RESOLVED_RE);
  return { decisions, questions, resolved };
};

function extractQuestions(text: string): ReadonlyArray<ExtractedQuestion> {
  const out: ExtractedQuestion[] = [];
  QUESTION_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = QUESTION_RE.exec(text)) !== null) {
    const suggestionsRaw = (m[1] ?? '').trim();
    const body = (m[2] ?? '').trim();
    if (body.length === 0) {
      continue;
    }
    const suggestedAnswers =
      suggestionsRaw.length > 0
        ? suggestionsRaw
            .split('|')
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        : [];
    out.push({ text: body, suggestedAnswers });
  }
  return out;
}

export type ExtractedPlan = {
  readonly title: string;
  readonly bodyMd: string;
};

export const extractPlanFromMarker = (assistantText: string): ExtractedPlan | null => {
  const matches = extractAll(assistantText, PLAN_RE);
  if (matches.length === 0) {
    return null;
  }
  const raw = matches[matches.length - 1]!;
  return parsePlanBody(raw);
};

function parsePlanBody(raw: string): ExtractedPlan | null {
  const lines = raw.split('\n');
  let firstIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const ln = (lines[i] ?? '').trim();
    if (ln.length > 0) {
      firstIdx = i;
      break;
    }
  }
  if (firstIdx === -1) {
    return null;
  }
  const titleLine = (lines[firstIdx] ?? '').trim();
  const title = titleLine.replace(/^#+\s*/, '').trim();
  if (title.length === 0) {
    return null;
  }
  const restLines = lines.slice(firstIdx + 1);
  let bodyMd = restLines.join('\n').replace(/^\n+/, '').replace(/\n+$/, '');
  if (bodyMd.length === 0) {
    bodyMd = title;
  }
  return { title, bodyMd };
}

const HANDOFF_KINDS: ReadonlySet<AgentKindLabel> = new Set([
  'planner',
  'scout',
  'implementer',
  'debugger',
  'tester',
  'docs',
  'reviewer',
  'generic',
]);

export type ExtractedHandoff = {
  readonly kind: AgentKindLabel;
  readonly reason: string;
  readonly planId: string | null;
};

export const extractHandoff = (assistantText: string): ExtractedHandoff | null => {
  HANDOFF_RE.lastIndex = 0;
  let last: ExtractedHandoff | null = null;
  let m: RegExpExecArray | null;
  while ((m = HANDOFF_RE.exec(assistantText)) !== null) {
    const inner = m[1] ?? '';
    const attrs = parseHandoffAttrs(inner);
    const kindRaw = attrs.kind?.toLowerCase() ?? '';
    if (!HANDOFF_KINDS.has(kindRaw as AgentKindLabel)) {
      continue;
    }
    last = {
      kind: kindRaw as AgentKindLabel,
      reason: attrs.reason?.trim() ?? '',
      planId: attrs.plan?.trim() || null,
    };
  }
  return last;
};

function parseHandoffAttrs(inner: string): Record<string, string> {
  const out: Record<string, string> = {};
  HANDOFF_ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = HANDOFF_ATTR_RE.exec(inner)) !== null) {
    const key = (m[1] ?? '').toLowerCase();
    const value = m[2] ?? m[3] ?? m[4] ?? '';
    if (key.length > 0) {
      out[key] = value;
    }
  }
  return out;
}

const COMMENT_RESOLVED_RE = /<<comment-resolved\s+([^>]+?)>>/g;

export type ExtractedCommentResolution = {
  readonly threadId: string;
  readonly commitSha: string;
};

export const extractCommentResolved = (
  assistantText: string,
): ExtractedCommentResolution | null => {
  COMMENT_RESOLVED_RE.lastIndex = 0;
  let last: ExtractedCommentResolution | null = null;
  let m: RegExpExecArray | null;
  while ((m = COMMENT_RESOLVED_RE.exec(assistantText)) !== null) {
    const inner = m[1] ?? '';
    const attrs = parseHandoffAttrs(inner);
    const threadId = (attrs.threadid ?? attrs.thread ?? '').trim();
    const commitSha = (attrs.commit ?? attrs.sha ?? '').trim();
    if (threadId.length === 0 || commitSha.length === 0) {
      continue;
    }
    last = { threadId, commitSha };
  }
  return last;
};

const REVIEW_THREAD_ID_RE = /^PRRT_/;

export const isReviewThreadId = (threadId: string): boolean => {
  return REVIEW_THREAD_ID_RE.test(threadId);
};

const COMMENT_WONTFIX_RE = /<<comment-wontfix\s+([^>]+?)>>/g;

export type ExtractedCommentWontfix = {
  readonly threadId: string;
  readonly reason: string;
};

export const extractCommentWontfix = (assistantText: string): ExtractedCommentWontfix | null => {
  COMMENT_WONTFIX_RE.lastIndex = 0;
  let last: ExtractedCommentWontfix | null = null;
  let m: RegExpExecArray | null;
  while ((m = COMMENT_WONTFIX_RE.exec(assistantText)) !== null) {
    const attrs = parseHandoffAttrs(m[1] ?? '');
    const threadId = (attrs.threadid ?? attrs.thread ?? '').trim();
    const reason = (attrs.reason ?? '').trim();
    if (threadId.length === 0 || reason.length === 0) {
      continue;
    }
    last = { threadId, reason };
  }
  return last;
};

const CLUSTERS_RE = /<<clusters>>([\s\S]*?)<<\/clusters>>/g;
const CLUSTER_DONE_RE = /<<cluster-done\s+([^>]+?)>>/g;

export type ExtractedCluster = {
  readonly title: string;
  readonly instructions: string;
};

export const extractClustersFromMarker = (
  assistantText: string,
): ReadonlyArray<ExtractedCluster> | null => {
  CLUSTERS_RE.lastIndex = 0;
  let raw: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = CLUSTERS_RE.exec(assistantText)) !== null) {
    const inner = (m[1] ?? '').trim();
    if (inner.length > 0) {
      raw = inner;
    }
  }
  if (raw === null) {
    return null;
  }

  const json = stripJsonFences(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    const arr = extractJsonArray(json);
    if (arr === null) {
      return null;
    }
    try {
      parsed = JSON.parse(arr);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(parsed)) {
    return null;
  }

  const out: ExtractedCluster[] = [];
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const e = entry as Record<string, unknown>;
    const title = typeof e.title === 'string' ? e.title.trim() : '';
    const instructions = typeof e.instructions === 'string' ? e.instructions.trim() : '';
    if (title.length === 0 || instructions.length === 0) {
      continue;
    }
    out.push({ title, instructions });
  }
  return out.length > 0 ? out : null;
};

export const extractClusterDone = (assistantText: string): { readonly id: string } | null => {
  CLUSTER_DONE_RE.lastIndex = 0;
  let last: { id: string } | null = null;
  let m: RegExpExecArray | null;
  while ((m = CLUSTER_DONE_RE.exec(assistantText)) !== null) {
    const inner = m[1] ?? '';
    const attrs = parseHandoffAttrs(inner);
    const id = (attrs.id ?? '').trim();
    if (id.length === 0) {
      continue;
    }
    last = { id };
  }
  return last;
};

const SCOUT_SPLIT_RE = /<<scout-split>>([\s\S]*?)<<\/scout-split>>/g;

export type ExtractedScoutArea = {
  readonly area: string;
  readonly query: string;
};

export const extractScoutSplit = (
  assistantText: string,
): ReadonlyArray<ExtractedScoutArea> | null => {
  SCOUT_SPLIT_RE.lastIndex = 0;
  let raw: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = SCOUT_SPLIT_RE.exec(assistantText)) !== null) {
    const inner = (m[1] ?? '').trim();
    if (inner.length > 0) {
      raw = inner;
    }
  }
  if (raw === null) {
    return null;
  }

  const json = stripJsonFences(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    const arr = extractJsonArray(json);
    if (arr === null) {
      return null;
    }
    try {
      parsed = JSON.parse(arr);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(parsed)) {
    return null;
  }

  const out: ExtractedScoutArea[] = [];
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const e = entry as Record<string, unknown>;
    const area = typeof e.area === 'string' ? e.area.trim() : '';
    const query = typeof e.query === 'string' ? e.query.trim() : '';
    if (area.length === 0 || query.length === 0) {
      continue;
    }
    out.push({ area, query });
  }
  return out.length > 0 ? out : null;
};

function stripJsonFences(raw: string): string {
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(raw.trim());
  return (fenced?.[1] ?? raw).trim();
}

function extractJsonArray(text: string): string | null {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return text.slice(start, end + 1);
}

const PLAN_OPEN_QUESTION_RE =
  /\b(vuoi che|ti torna|che ne dici|should i|let me know|do you want|shall i|wdyt|preferisci)\b/i;
const PLAN_INCOMPLETE_RE = /\b(TODO|TBD|FIXME|\?\?)\b/i;
const PLAN_STEP_RE = /^\s*(?:\d+[.)]|[-*])\s+\S/m;

export type PlanReadinessInput = {
  readonly planBody: string;
  readonly assistantText: string;
};

export type PlanReadinessResult = {
  readonly ready: boolean;
  readonly reason: 'has-open-question' | 'incomplete-markers' | 'too-few-steps' | null;
};

export const assessPlanReadiness = (input: PlanReadinessInput): PlanReadinessResult => {
  if (PLAN_INCOMPLETE_RE.test(input.planBody)) {
    return { ready: false, reason: 'incomplete-markers' };
  }
  const stepLines = input.planBody.split('\n').filter((line) => PLAN_STEP_RE.test(line));
  if (stepLines.length < 2) {
    return { ready: false, reason: 'too-few-steps' };
  }
  const outsidePlan = input.assistantText.replace(PLAN_RE, '').trim();
  if (PLAN_OPEN_QUESTION_RE.test(outsidePlan)) {
    return { ready: false, reason: 'has-open-question' };
  }
  return { ready: true, reason: null };
};

function extractAll(text: string, re: RegExp): ReadonlyArray<string> {
  const out: string[] = [];
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const value = (m[1] ?? '').trim();
    if (value.length > 0) {
      out.push(value);
    }
  }
  return out;
}

export const mergeIntoSlot = (existing: string, additions: ReadonlyArray<string>): string => {
  if (additions.length === 0) {
    return existing;
  }
  const lines = existing.length > 0 ? existing.split('\n') : [];
  const seen = new Set(lines.map((l) => l.trim()));
  let changed = false;
  for (const add of additions) {
    const trimmed = add.trim();
    if (trimmed.length === 0) {
      continue;
    }
    if (seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    lines.push(trimmed);
    changed = true;
  }
  return changed ? lines.join('\n') : existing;
};

export const removeFromSlot = (existing: string, removals: ReadonlyArray<string>): string => {
  if (removals.length === 0 || existing.length === 0) {
    return existing;
  }
  const norm = (s: string) =>
    s
      .replace(/^\s*(?:[-*]|\d+\.)\s+/, '')
      .trim()
      .toLowerCase();
  const targets = removals.map(norm).filter((s) => s.length > 0);
  if (targets.length === 0) {
    return existing;
  }
  const lines = existing.split('\n');
  const kept: string[] = [];
  let changed = false;
  for (const line of lines) {
    const n = norm(line);
    if (n.length === 0) {
      kept.push(line);
      continue;
    }
    const matches = targets.some((t) => n === t || n.includes(t) || t.includes(n));
    if (matches) {
      changed = true;
      continue;
    }
    kept.push(line);
  }
  return changed ? kept.join('\n') : existing;
};
