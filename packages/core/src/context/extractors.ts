import type { TurnEvent } from '@goodboy/types';
import type { AgentKindLabel } from '../first-turn-classifier';

// Extractors that turn raw turn output into ContextPanel updates. Each
// exported fn is pure, caller persists via the ContextEngine. Split kept
// extractors trivially testable and lets the store decide when to flush.

/**
 * Collect the unique file paths an agent touched during a turn from its
 * `file_edit` events. Used to maintain the `files_touched` slot.
 */
export function extractFilesTouched(events: ReadonlyArray<TurnEvent>): ReadonlyArray<string> {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ev of events) {
    if (ev.kind !== 'file_edit') continue;
    if (seen.has(ev.path)) continue;
    seen.add(ev.path);
    out.push(ev.path);
  }
  return out;
}

const QUESTION_OPEN_RE = /<<ctx-question(?:\s+suggestions="([^"]*)")?>>/g;
const QUESTION_CLOSE = '<</ctx-question>>';
const LEADING_SPACE_RE = /^\s/;

function extractSelfClosing(text: string, name: string): ReadonlyArray<string> {
  const open = `<<${name}`;
  const out: string[] = [];
  let idx = 0;
  while (idx < text.length) {
    const start = text.indexOf(open, idx);
    if (start === -1) break;
    const after = start + open.length;
    const close = text.indexOf('>>', after);
    if (close === -1) break;
    idx = close + 2;
    const inner = text.slice(after, close);
    if (inner.length > 0 && LEADING_SPACE_RE.test(inner) && !inner.includes('>')) out.push(inner);
  }
  return out;
}

function extractAllTagged(text: string, tag: string): ReadonlyArray<string> {
  const open = `<<${tag}>>`;
  const close = `<</${tag}>>`;
  const out: string[] = [];
  let idx = 0;
  while (idx < text.length) {
    const start = text.indexOf(open, idx);
    if (start === -1) break;
    const end = text.indexOf(close, start + open.length);
    if (end === -1) break;
    const value = text.slice(start + open.length, end).trim();
    if (value.length > 0) out.push(value);
    idx = end + close.length;
  }
  return out;
}

function stripTagged(text: string, tag: string): string {
  const open = `<<${tag}>>`;
  const close = `<</${tag}>>`;
  let out = '';
  let idx = 0;
  while (idx < text.length) {
    const start = text.indexOf(open, idx);
    if (start === -1) break;
    const end = text.indexOf(close, start + open.length);
    if (end === -1) break;
    out += text.slice(idx, start);
    idx = end + close.length;
  }
  return out + text.slice(idx);
}

function trimNewlines(s: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && s.charAt(start) === '\n') start++;
  while (end > start && s.charAt(end - 1) === '\n') end--;
  return s.slice(start, end);
}

export interface ExtractedQuestion {
  readonly text: string;
  readonly suggestedAnswers: ReadonlyArray<string>;
}

/**
 * Pull agent-emitted markers out of an assistant turn's full text. Agents
 * are instructed (via system prompt) to wrap durable observations like:
 *   <<ctx-decision>>switching auth to OAuth2 PKCE<</ctx-decision>>
 *   <<ctx-question>>do we need refresh tokens?<</ctx-question>>
 *   <<ctx-question suggestions="yes | no | maybe">>bounded question<</ctx-question>>
 *   <<ctx-resolved>>do we need refresh tokens?<</ctx-resolved>>
 *
 * Questions may embed pipe-separated suggested answers via the `suggestions`
 * attribute. The marker form is intentionally verbose so the model rarely
 * emits it by accident in casual prose. Whitespace inside is trimmed.
 */
export function extractMarkers(assistantText: string): {
  readonly decisions: ReadonlyArray<string>;
  readonly questions: ReadonlyArray<ExtractedQuestion>;
  readonly resolved: ReadonlyArray<string>;
} {
  const decisions = extractAllTagged(assistantText, 'ctx-decision');
  const questions = extractQuestions(assistantText);
  const resolved = extractAllTagged(assistantText, 'ctx-resolved');
  return { decisions, questions, resolved };
}

function extractQuestions(text: string): ReadonlyArray<ExtractedQuestion> {
  const out: ExtractedQuestion[] = [];
  QUESTION_OPEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = QUESTION_OPEN_RE.exec(text)) !== null) {
    const bodyStart = m.index + m[0].length;
    const end = text.indexOf(QUESTION_CLOSE, bodyStart);
    if (end === -1) break;
    QUESTION_OPEN_RE.lastIndex = end + QUESTION_CLOSE.length;
    const suggestionsRaw = (m[1] ?? '').trim();
    const body = text.slice(bodyStart, end).trim();
    if (body.length === 0) continue;
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

/**
 * Pull the most recent `<<plan>>...<</plan>>` block from an assistant turn.
 * Planning agents wrap a Markdown body inside the marker, title is the first
 * non-empty line (with leading `#` stripped); body is the rest. Returns null
 * when no marker is present or its content is empty.
 *
 * If multiple plans appear in one turn (rare), the last one wins, agents are
 * expected to emit one final plan per turn.
 */
export interface ExtractedPlan {
  readonly title: string;
  readonly bodyMd: string;
}

export function extractPlanFromMarker(assistantText: string): ExtractedPlan | null {
  const matches = extractAllTagged(assistantText, 'plan');
  if (matches.length === 0) return null;
  const raw = matches[matches.length - 1]!;
  return parsePlanBody(raw);
}

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
  if (firstIdx === -1) return null;
  const titleLine = (lines[firstIdx] ?? '').trim();
  const title = titleLine.replace(/^#+\s*/, '').trim();
  if (title.length === 0) return null;
  const restLines = lines.slice(firstIdx + 1);
  let bodyMd = trimNewlines(restLines.join('\n'));
  if (bodyMd.length === 0) bodyMd = title;
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

export interface ExtractedHandoff {
  readonly kind: AgentKindLabel;
  readonly reason: string;
  readonly planId: string | null;
}

/**
 * Parse the last `<<handoff kind=... reason="..." plan=...>>` marker out of an
 * assistant turn. Agents emit it when they consider their scope done and want
 * to suggest the next agent. Self-closing format. Unknown kinds are rejected.
 */
export function extractHandoff(assistantText: string): ExtractedHandoff | null {
  let last: ExtractedHandoff | null = null;
  for (const inner of extractSelfClosing(assistantText, 'handoff')) {
    const attrs = parseHandoffAttrs(inner);
    const kindRaw = attrs.kind?.toLowerCase() ?? '';
    if (!HANDOFF_KINDS.has(kindRaw as AgentKindLabel)) continue;
    last = {
      kind: kindRaw as AgentKindLabel,
      reason: attrs.reason?.trim() ?? '',
      planId: attrs.plan?.trim() || null,
    };
  }
  return last;
}

const WORD_CHAR_RE = /\w/;
const SPACE_CHAR_RE = /\s/;

function parseHandoffAttrs(inner: string): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i < inner.length) {
    if (!WORD_CHAR_RE.test(inner.charAt(i))) {
      i++;
      continue;
    }
    const keyStart = i;
    while (i < inner.length && WORD_CHAR_RE.test(inner.charAt(i))) i++;
    const key = inner.slice(keyStart, i).toLowerCase();
    let j = i;
    while (j < inner.length && SPACE_CHAR_RE.test(inner.charAt(j))) j++;
    if (inner.charAt(j) !== '=') continue;
    j++;
    while (j < inner.length && SPACE_CHAR_RE.test(inner.charAt(j))) j++;
    const parsed = parseAttrValue(inner, j);
    if (parsed === null) continue;
    out[key] = parsed.value;
    i = parsed.end;
  }
  return out;
}

function parseAttrValue(inner: string, from: number): { value: string; end: number } | null {
  const quote = inner.charAt(from);
  if (quote === '"' || quote === "'") {
    const closing = inner.indexOf(quote, from + 1);
    if (closing !== -1) return { value: inner.slice(from + 1, closing), end: closing + 1 };
  }
  let end = from;
  while (end < inner.length && !SPACE_CHAR_RE.test(inner.charAt(end))) end++;
  if (end === from) return null;
  return { value: inner.slice(from, end), end };
}

export interface ExtractedCommentResolution {
  readonly threadId: string;
  readonly commitSha: string;
}

/**
 * Parse a `<<comment-resolved threadId="..." commit="<sha>">>` marker out of an
 * assistant turn. Comment-resolution agents emit it after they apply the fix
 * and create a local commit, so the chat surface can offer a one-click action
 * that marks the underlying review thread resolved on github.
 *
 * Self-closing. If multiple markers exist (rare, the agent should emit one
 * after committing), the last one wins. Returns null if no well-formed marker
 * is present.
 */
export function extractCommentResolved(assistantText: string): ExtractedCommentResolution | null {
  let last: ExtractedCommentResolution | null = null;
  for (const inner of extractSelfClosing(assistantText, 'comment-resolved')) {
    const attrs = parseHandoffAttrs(inner);
    const threadId = (attrs.threadid ?? attrs.thread ?? '').trim();
    const commitSha = (attrs.commit ?? attrs.sha ?? '').trim();
    if (threadId.length === 0 || commitSha.length === 0) continue;
    last = { threadId, commitSha };
  }
  return last;
}

const REVIEW_THREAD_ID_RE = /^PRRT_/;

export function isReviewThreadId(threadId: string): boolean {
  return REVIEW_THREAD_ID_RE.test(threadId);
}

export interface ExtractedCommentWontfix {
  readonly threadId: string;
  readonly reason: string;
}

export function extractCommentWontfix(assistantText: string): ExtractedCommentWontfix | null {
  let last: ExtractedCommentWontfix | null = null;
  for (const inner of extractSelfClosing(assistantText, 'comment-wontfix')) {
    const attrs = parseHandoffAttrs(inner);
    const threadId = (attrs.threadid ?? attrs.thread ?? '').trim();
    const reason = (attrs.reason ?? '').trim();
    if (threadId.length === 0 || reason.length === 0) continue;
    last = { threadId, reason };
  }
  return last;
}

export interface ExtractedCluster {
  readonly title: string;
  readonly instructions: string;
}

export function extractClustersFromMarker(
  assistantText: string,
): ReadonlyArray<ExtractedCluster> | null {
  const blocks = extractAllTagged(assistantText, 'clusters');
  const raw = blocks.length > 0 ? blocks[blocks.length - 1]! : null;
  if (raw === null) return null;

  const json = stripJsonFences(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    const arr = extractJsonArray(json);
    if (arr === null) return null;
    try {
      parsed = JSON.parse(arr);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(parsed)) return null;

  const out: ExtractedCluster[] = [];
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as Record<string, unknown>;
    const title = typeof e.title === 'string' ? e.title.trim() : '';
    const instructions = typeof e.instructions === 'string' ? e.instructions.trim() : '';
    if (title.length === 0 || instructions.length === 0) continue;
    out.push({ title, instructions });
  }
  return out.length > 0 ? out : null;
}

export function extractClusterDone(assistantText: string): { readonly id: string } | null {
  let last: { id: string } | null = null;
  for (const inner of extractSelfClosing(assistantText, 'cluster-done')) {
    const attrs = parseHandoffAttrs(inner);
    const id = (attrs.id ?? '').trim();
    if (id.length === 0) continue;
    last = { id };
  }
  return last;
}

export interface ExtractedScoutArea {
  readonly area: string;
  readonly query: string;
}

export function extractScoutSplit(assistantText: string): ReadonlyArray<ExtractedScoutArea> | null {
  const blocks = extractAllTagged(assistantText, 'scout-split');
  const raw = blocks.length > 0 ? blocks[blocks.length - 1]! : null;
  if (raw === null) return null;

  const json = stripJsonFences(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    const arr = extractJsonArray(json);
    if (arr === null) return null;
    try {
      parsed = JSON.parse(arr);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(parsed)) return null;

  const out: ExtractedScoutArea[] = [];
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as Record<string, unknown>;
    const area = typeof e.area === 'string' ? e.area.trim() : '';
    const query = typeof e.query === 'string' ? e.query.trim() : '';
    if (area.length === 0 || query.length === 0) continue;
    out.push({ area, query });
  }
  return out.length > 0 ? out : null;
}

function stripJsonFences(raw: string): string {
  const fenced = /^```(?:json)?([\s\S]*?)```$/i.exec(raw.trim());
  return (fenced?.[1] ?? raw).trim();
}

function extractJsonArray(text: string): string | null {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

const PLAN_OPEN_QUESTION_RE =
  /\b(vuoi che|ti torna|che ne dici|should i|let me know|do you want|shall i|wdyt|preferisci)\b/i;
const PLAN_INCOMPLETE_RE = /\b(TODO|TBD|FIXME|\?\?)\b/i;
const PLAN_STEP_RE = /^\s*(?:\d+[.)]|[-*])\s+\S/m;

export interface PlanReadinessInput {
  readonly planBody: string;
  readonly assistantText: string;
}

export interface PlanReadinessResult {
  readonly ready: boolean;
  readonly reason: 'has-open-question' | 'incomplete-markers' | 'too-few-steps' | null;
}

/**
 * Heuristic check for whether a freshly emitted plan looks complete enough to
 * justify suggesting the implementer agent. Conservative on purpose, false
 * positives mean noisy nudges. Three rejections:
 *   - body contains TODO / TBD / FIXME / ??
 *   - body has fewer than 2 bulleted/numbered steps
 *   - assistant text outside the plan block asks an open question
 */
export function assessPlanReadiness(input: PlanReadinessInput): PlanReadinessResult {
  if (PLAN_INCOMPLETE_RE.test(input.planBody)) {
    return { ready: false, reason: 'incomplete-markers' };
  }
  const stepLines = input.planBody.split('\n').filter((line) => PLAN_STEP_RE.test(line));
  if (stepLines.length < 2) {
    return { ready: false, reason: 'too-few-steps' };
  }
  const outsidePlan = stripTagged(input.assistantText, 'plan').trim();
  if (PLAN_OPEN_QUESTION_RE.test(outsidePlan)) {
    return { ready: false, reason: 'has-open-question' };
  }
  return { ready: true, reason: null };
}

/**
 * Append `additions` to an existing newline-separated slot value, dedup'ing
 * by exact-match line. Order: existing lines first, new ones after.
 *
 * Returns the merged value. If nothing changed (every addition already
 * present), returns the original string verbatim, caller can use that to
 * skip the upsert.
 */
export function mergeIntoSlot(existing: string, additions: ReadonlyArray<string>): string {
  if (additions.length === 0) return existing;
  const lines = existing.length > 0 ? existing.split('\n') : [];
  const seen = new Set(lines.map((l) => l.trim()));
  let changed = false;
  for (const add of additions) {
    const trimmed = add.trim();
    if (trimmed.length === 0) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    lines.push(trimmed);
    changed = true;
  }
  return changed ? lines.join('\n') : existing;
}

/**
 * Remove lines from `existing` that match any string in `removals`, match is
 * case-insensitive, ignores leading list markers (`-`, `*`, `1.`), and
 * succeeds when one is a substring of the other. Used to clean up resolved
 * open questions when the agent emits `<<ctx-resolved>>` markers.
 *
 * Returns the original string verbatim if nothing matched, so the caller can
 * skip the upsert.
 */
export function removeFromSlot(existing: string, removals: ReadonlyArray<string>): string {
  if (removals.length === 0 || existing.length === 0) return existing;
  const norm = (s: string) =>
    s
      .replace(/^\s*(?:[-*]|\d+\.)\s+/, '')
      .trim()
      .toLowerCase();
  const targets = removals.map(norm).filter((s) => s.length > 0);
  if (targets.length === 0) return existing;
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
}
