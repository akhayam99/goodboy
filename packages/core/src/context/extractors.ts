import type { TurnEvent } from '@goodboy/types';
import type { AgentKindLabel } from '../first-turn-classifier';

// Extractors that turn raw turn output into ContextPanel updates. Each
// exported fn is pure — caller persists via the ContextEngine. Split kept
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

const DECISION_RE = /<<ctx-decision>>([\s\S]*?)<<\/ctx-decision>>/g;
const QUESTION_RE = /<<ctx-question>>([\s\S]*?)<<\/ctx-question>>/g;
const RESOLVED_RE = /<<ctx-resolved>>([\s\S]*?)<<\/ctx-resolved>>/g;
const PLAN_RE = /<<plan>>([\s\S]*?)<<\/plan>>/g;
const HANDOFF_RE = /<<handoff\s+([^>]+?)>>/g;
const HANDOFF_ATTR_RE = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;

/**
 * Pull agent-emitted markers out of an assistant turn's full text. Agents
 * are instructed (via system prompt) to wrap durable observations like:
 *   <<ctx-decision>>switching auth to OAuth2 PKCE<</ctx-decision>>
 *   <<ctx-question>>do we need refresh tokens?<</ctx-question>>
 *   <<ctx-resolved>>do we need refresh tokens?<</ctx-resolved>>
 *
 * `resolved` removes a previously open question once the user has answered it
 * — same text as the original question (case-insensitive substring match).
 *
 * The marker form is intentionally verbose so the model rarely emits it by
 * accident in casual prose. Whitespace inside is trimmed.
 */
export function extractMarkers(assistantText: string): {
  readonly decisions: ReadonlyArray<string>;
  readonly questions: ReadonlyArray<string>;
  readonly resolved: ReadonlyArray<string>;
} {
  const decisions = extractAll(assistantText, DECISION_RE);
  const questions = extractAll(assistantText, QUESTION_RE);
  const resolved = extractAll(assistantText, RESOLVED_RE);
  return { decisions, questions, resolved };
}

/**
 * Pull the most recent `<<plan>>...<</plan>>` block from an assistant turn.
 * Planning agents wrap a Markdown body inside the marker — title is the first
 * non-empty line (with leading `#` stripped); body is the rest. Returns null
 * when no marker is present or its content is empty.
 *
 * If multiple plans appear in one turn (rare), the last one wins — agents are
 * expected to emit one final plan per turn.
 */
export interface ExtractedPlan {
  readonly title: string;
  readonly bodyMd: string;
}

export function extractPlanFromMarker(assistantText: string): ExtractedPlan | null {
  const matches = extractAll(assistantText, PLAN_RE);
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
  let bodyMd = restLines.join('\n').replace(/^\n+/, '').replace(/\n+$/, '');
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
  HANDOFF_RE.lastIndex = 0;
  let last: ExtractedHandoff | null = null;
  let m: RegExpExecArray | null;
  while ((m = HANDOFF_RE.exec(assistantText)) !== null) {
    const inner = m[1] ?? '';
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

function parseHandoffAttrs(inner: string): Record<string, string> {
  const out: Record<string, string> = {};
  HANDOFF_ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = HANDOFF_ATTR_RE.exec(inner)) !== null) {
    const key = (m[1] ?? '').toLowerCase();
    const value = m[2] ?? m[3] ?? m[4] ?? '';
    if (key.length > 0) out[key] = value;
  }
  return out;
}

const COMMENT_RESOLVED_RE = /<<comment-resolved\s+([^>]+?)>>/g;

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
 * Self-closing. If multiple markers exist (rare — the agent should emit one
 * after committing), the last one wins. Returns null if no well-formed marker
 * is present.
 */
export function extractCommentResolved(assistantText: string): ExtractedCommentResolution | null {
  COMMENT_RESOLVED_RE.lastIndex = 0;
  let last: ExtractedCommentResolution | null = null;
  let m: RegExpExecArray | null;
  while ((m = COMMENT_RESOLVED_RE.exec(assistantText)) !== null) {
    const inner = m[1] ?? '';
    const attrs = parseHandoffAttrs(inner);
    const threadId = (attrs.threadid ?? attrs.thread ?? '').trim();
    const commitSha = (attrs.commit ?? attrs.sha ?? '').trim();
    if (threadId.length === 0 || commitSha.length === 0) continue;
    last = { threadId, commitSha };
  }
  return last;
}

const COMMENT_DISMISSED_RE = /<<comment-dismissed\s+([^>]+?)>>/g;

export interface ExtractedCommentDismissal {
  readonly threadId: string;
  readonly reason: string;
}

/**
 * Parse a `<<comment-dismissed threadId="..." reason="...">>` marker out of an
 * assistant turn. Resolver agents emit it when they decide a review comment is
 * not actionable (off-topic, wontfix, out of scope, already-fixed) so the chat
 * surface can offer a one-click action that closes the underlying review
 * thread on github with the reason posted as a reply.
 *
 * Self-closing. Last marker wins if multiple present. Returns null if no
 * well-formed marker is present (both threadId and reason are required).
 */
export function extractCommentDismissed(assistantText: string): ExtractedCommentDismissal | null {
  COMMENT_DISMISSED_RE.lastIndex = 0;
  let last: ExtractedCommentDismissal | null = null;
  let m: RegExpExecArray | null;
  while ((m = COMMENT_DISMISSED_RE.exec(assistantText)) !== null) {
    const inner = m[1] ?? '';
    const attrs = parseHandoffAttrs(inner);
    const threadId = (attrs.threadid ?? attrs.thread ?? '').trim();
    const reason = (attrs.reason ?? '').trim();
    if (threadId.length === 0 || reason.length === 0) continue;
    last = { threadId, reason };
  }
  return last;
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
 * justify suggesting the implementer agent. Conservative on purpose — false
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
  const outsidePlan = input.assistantText.replace(PLAN_RE, '').trim();
  if (PLAN_OPEN_QUESTION_RE.test(outsidePlan)) {
    return { ready: false, reason: 'has-open-question' };
  }
  return { ready: true, reason: null };
}

function extractAll(text: string, re: RegExp): ReadonlyArray<string> {
  const out: string[] = [];
  // Reset lastIndex because we share the global regex across calls.
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const value = (m[1] ?? '').trim();
    if (value.length > 0) out.push(value);
  }
  return out;
}

/**
 * Append `additions` to an existing newline-separated slot value, dedup'ing
 * by exact-match line. Order: existing lines first, new ones after.
 *
 * Returns the merged value. If nothing changed (every addition already
 * present), returns the original string verbatim — caller can use that to
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
 * Remove lines from `existing` that match any string in `removals` — match is
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
