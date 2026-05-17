import type { TurnEvent } from '@kay-am/types';

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
 * Represents a single open question, optionally with predefined answer choices.
 * Questions without options fall back to plain-text rendering in the UI.
 */
export interface ParsedQuestion {
  readonly text: string;
  readonly options: ReadonlyArray<string>;
}

/**
 * Parse one line from the `open_questions` slot into its question text and
 * optional predefined options. The structured form is:
 *   "question text || option A | option B | option C"
 * Lines without `||` have an empty options array (backward-compatible).
 */
export function parseQuestionLine(line: string): ParsedQuestion {
  const sep = line.indexOf(' || ');
  if (sep === -1) return { text: line.trim(), options: [] };
  const text = line.slice(0, sep).trim();
  const options = line
    .slice(sep + 4)
    .split('|')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
  return { text, options };
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
