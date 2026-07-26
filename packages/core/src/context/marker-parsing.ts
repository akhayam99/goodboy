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

const DECISION_OPEN = '<<ctx-decision>>';
const DECISION_CLOSE = '<</ctx-decision>>';
const RESOLVED_OPEN = '<<ctx-resolved>>';
const RESOLVED_CLOSE = '<</ctx-resolved>>';
const PLAN_OPEN = '<<plan>>';
const PLAN_CLOSE = '<</plan>>';
const CLUSTERS_OPEN = '<<clusters>>';
const CLUSTERS_CLOSE = '<</clusters>>';
const SCOUT_SPLIT_OPEN = '<<scout-split>>';
const SCOUT_SPLIT_CLOSE = '<</scout-split>>';
const QUESTION_OPEN_RE = /<<ctx-question((?:\s+[\w-]+="[^"]*")*)\s*>>/g;
const QUESTION_CLOSE = '<</ctx-question>>';
const QUESTION_ATTR_RE = /(?<![\w-])([\w-]+)="([^"]*)"/g;
const HANDOFF_OPEN = '<<handoff';
const COMMENT_ANALYSIS_OPEN = '<<comment-analysis';
const COMMENT_RESOLVED_OPEN = '<<comment-resolved';
const COMMENT_WONTFIX_OPEN = '<<comment-wontfix';
const CLUSTER_DONE_OPEN = '<<cluster-done';
const SCOUT_DOMAINS_OPEN = '<<scout-domains';
const REVIEW_COMMENT_OPEN = '<<review-comment';
const SCOUT_DOMAIN_RE = /^[a-z0-9][a-z0-9_-]*$/;

const extractSelfClosingInner = (text: string, open: string): ReadonlyArray<string> => {
  const out: string[] = [];
  let i = 0;
  while (true) {
    const start = text.indexOf(open, i);
    if (start === -1) {
      break;
    }
    const afterOpen = start + open.length;
    const gt = text.indexOf('>', afterOpen);
    if (gt === -1) {
      break;
    }
    if (text[gt + 1] !== '>') {
      i = afterOpen;
      continue;
    }
    const inner = text.slice(afterOpen, gt);
    const capture = inner.replace(/^\s+/, '');
    if (inner.length > capture.length && capture.length > 0) {
      out.push(capture);
    }
    i = gt + 2;
  }
  return out;
};

const extractBlockContents = (text: string, open: string, close: string): ReadonlyArray<string> => {
  const out: string[] = [];
  let i = 0;
  while (true) {
    const start = text.indexOf(open, i);
    if (start === -1) {
      break;
    }
    const contentStart = start + open.length;
    const end = text.indexOf(close, contentStart);
    if (end === -1) {
      break;
    }
    const value = text.slice(contentStart, end).trim();
    if (value.length > 0) {
      out.push(value);
    }
    i = end + close.length;
  }
  return out;
};

const stripBlocks = (text: string, open: string, close: string): string => {
  let out = '';
  let i = 0;
  while (true) {
    const start = text.indexOf(open, i);
    if (start === -1) {
      out += text.slice(i);
      break;
    }
    const end = text.indexOf(close, start + open.length);
    if (end === -1) {
      out += text.slice(i);
      break;
    }
    out += text.slice(i, start);
    i = end + close.length;
  }
  return out;
};
const HANDOFF_ATTR_RE = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;

export type ExtractedQuestion = {
  readonly text: string;
  readonly suggestedAnswers: ReadonlyArray<string>;
  readonly recommendedAnswer: string | null;
};

export const extractMarkers = (
  assistantText: string,
): {
  readonly decisions: ReadonlyArray<string>;
  readonly questions: ReadonlyArray<ExtractedQuestion>;
  readonly resolved: ReadonlyArray<string>;
} => {
  const decisions = extractBlockContents(assistantText, DECISION_OPEN, DECISION_CLOSE);
  const questions = extractQuestions(assistantText);
  const resolved = extractBlockContents(assistantText, RESOLVED_OPEN, RESOLVED_CLOSE);
  return { decisions, questions, resolved };
};

function parseQuestionAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  QUESTION_ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = QUESTION_ATTR_RE.exec(raw)) !== null) {
    attrs[m[1]!] = m[2] ?? '';
  }
  return attrs;
}

function extractQuestions(text: string): ReadonlyArray<ExtractedQuestion> {
  const out: ExtractedQuestion[] = [];
  QUESTION_OPEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = QUESTION_OPEN_RE.exec(text)) !== null) {
    const bodyStart = QUESTION_OPEN_RE.lastIndex;
    const closeIdx = text.indexOf(QUESTION_CLOSE, bodyStart);
    if (closeIdx === -1) {
      continue;
    }
    QUESTION_OPEN_RE.lastIndex = closeIdx + QUESTION_CLOSE.length;
    const attrs = parseQuestionAttrs(m[1] ?? '');
    const body = text.slice(bodyStart, closeIdx).trim();
    if (body.length === 0) {
      continue;
    }
    const suggestionsRaw = attrs.suggestions ?? '';
    const suggestedAnswers =
      suggestionsRaw.length > 0
        ? suggestionsRaw
            .split('|')
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        : [];
    const recommended = (attrs.recommended ?? '').trim();
    out.push({
      text: body,
      suggestedAnswers,
      recommendedAnswer: recommended.length > 0 ? recommended : null,
    });
  }
  return out;
}

export type ExtractedPlan = {
  readonly title: string;
  readonly bodyMd: string;
};

export const extractPlanFromMarker = (assistantText: string): ExtractedPlan | null => {
  const matches = extractBlockContents(assistantText, PLAN_OPEN, PLAN_CLOSE);
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
  const joined = restLines.join('\n').replace(/^\n+/, '');
  let end = joined.length;
  while (end > 0 && joined[end - 1] === '\n') {
    end -= 1;
  }
  let bodyMd = joined.slice(0, end);
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
  let last: ExtractedHandoff | null = null;
  for (const inner of extractSelfClosingInner(assistantText, HANDOFF_OPEN)) {
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
  if (inner.length > 1000) {
    return out;
  }
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

export type ExtractedCommentResolution = {
  readonly threadId: string;
  readonly commitSha: string;
};

export const extractCommentResolved = (
  assistantText: string,
): ExtractedCommentResolution | null => {
  let last: ExtractedCommentResolution | null = null;
  for (const inner of extractSelfClosingInner(assistantText, COMMENT_RESOLVED_OPEN)) {
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

export const extractAllCommentResolved = (
  assistantText: string,
): ReadonlyArray<ExtractedCommentResolution> => {
  const markers: Array<ExtractedCommentResolution> = [];
  for (const inner of extractSelfClosingInner(assistantText, COMMENT_RESOLVED_OPEN)) {
    const attrs = parseHandoffAttrs(inner);
    const threadId = (attrs.threadid ?? attrs.thread ?? '').trim();
    const commitSha = (attrs.commitsha ?? attrs.commit ?? attrs.sha ?? '').trim();
    if (threadId.length === 0 || commitSha.length === 0) {
      continue;
    }
    markers.push({ threadId, commitSha });
  }
  return markers;
};

const REVIEW_THREAD_ID_RE = /^PRRT_/;

export const isReviewThreadId = (threadId: string): boolean => {
  return REVIEW_THREAD_ID_RE.test(threadId);
};

export type ExtractedCommentAnalysis = {
  readonly threadId: string;
  readonly verdict: 'fix' | 'wontfix';
  readonly summary: string;
};

type CommentAnalysisAttrs = {
  readonly threadid?: string;
  readonly verdict?: string;
  readonly summary?: string;
};

const parseStrictQuotedAttrs = (
  inner: string,
  allowedKeys: ReadonlySet<string>,
): Record<string, string> | null => {
  const attrs: Record<string, string> = {};
  let index = 0;
  while (index < inner.length) {
    while (index < inner.length && inner[index]?.trim() === '') {
      index += 1;
    }
    if (index === inner.length) {
      break;
    }
    const keyStart = index;
    while (index < inner.length && inner[index]?.trim() !== '' && inner[index] !== '=') {
      index += 1;
    }
    const key = inner.slice(keyStart, index).toLowerCase();
    if (!allowedKeys.has(key)) {
      return null;
    }
    if (attrs[key] != null) {
      return null;
    }
    while (index < inner.length && inner[index]?.trim() === '') {
      index += 1;
    }
    if (inner[index] !== '=') {
      return null;
    }
    index += 1;
    while (index < inner.length && inner[index]?.trim() === '') {
      index += 1;
    }
    if (inner[index] !== '"') {
      return null;
    }
    const valueStart = index + 1;
    const valueEnd = inner.indexOf('"', valueStart);
    if (valueEnd === -1) {
      return null;
    }
    attrs[key] = inner.slice(valueStart, valueEnd);
    index = valueEnd + 1;
    if (index < inner.length && inner[index]?.trim() !== '') {
      return null;
    }
  }
  return attrs;
};

const COMMENT_ANALYSIS_KEYS: ReadonlySet<string> = new Set(['threadid', 'verdict', 'summary']);

const parseCommentAnalysisAttrs = (inner: string): CommentAnalysisAttrs | null =>
  parseStrictQuotedAttrs(inner, COMMENT_ANALYSIS_KEYS);

export const extractCommentAnalysis = (assistantText: string): ExtractedCommentAnalysis | null => {
  let last: ExtractedCommentAnalysis | null = null;
  for (const inner of extractSelfClosingInner(assistantText, COMMENT_ANALYSIS_OPEN)) {
    const attrs = parseCommentAnalysisAttrs(inner);
    const threadId = attrs?.threadid?.trim() ?? '';
    const verdict = attrs?.verdict?.trim() ?? '';
    const summary = attrs?.summary?.trim() ?? '';
    if (!threadId.startsWith('PRRT_') || summary.length === 0) {
      continue;
    }
    if (verdict !== 'fix' && verdict !== 'wontfix') {
      continue;
    }
    last = { threadId, verdict, summary };
  }
  return last;
};

export const extractAllCommentAnalysis = (
  assistantText: string,
): ReadonlyArray<ExtractedCommentAnalysis> => {
  const markers: Array<ExtractedCommentAnalysis> = [];
  for (const inner of extractSelfClosingInner(assistantText, COMMENT_ANALYSIS_OPEN)) {
    const attrs = parseCommentAnalysisAttrs(inner);
    const threadId = attrs?.threadid?.trim() ?? '';
    const verdict = attrs?.verdict?.trim() ?? '';
    const summary = attrs?.summary?.trim() ?? '';
    if (!threadId.startsWith('PRRT_') || summary.length === 0) {
      continue;
    }
    if (verdict !== 'fix' && verdict !== 'wontfix') {
      continue;
    }
    markers.push({ threadId, verdict, summary });
  }
  return markers;
};

export type ExtractedCommentWontfix = {
  readonly threadId: string;
  readonly reason: string;
};

export const extractCommentWontfix = (assistantText: string): ExtractedCommentWontfix | null => {
  let last: ExtractedCommentWontfix | null = null;
  for (const inner of extractSelfClosingInner(assistantText, COMMENT_WONTFIX_OPEN)) {
    const attrs = parseHandoffAttrs(inner);
    const threadId = (attrs.threadid ?? attrs.thread ?? '').trim();
    const reason = (attrs.reason ?? '').trim();
    if (threadId.length === 0 || reason.length === 0) {
      continue;
    }
    last = { threadId, reason };
  }
  return last;
};

export const extractAllCommentWontfix = (
  assistantText: string,
): ReadonlyArray<ExtractedCommentWontfix> => {
  const markers: Array<ExtractedCommentWontfix> = [];
  for (const inner of extractSelfClosingInner(assistantText, COMMENT_WONTFIX_OPEN)) {
    const attrs = parseHandoffAttrs(inner);
    const threadId = (attrs.threadid ?? attrs.thread ?? '').trim();
    const reason = (attrs.reason ?? '').trim();
    if (threadId.length === 0 || reason.length === 0) {
      continue;
    }
    markers.push({ threadId, reason });
  }
  return markers;
};

export type ExtractedReviewComment = {
  readonly path: string;
  readonly line: number;
  readonly startLine: number | null;
  readonly side: 'new' | 'old';
  readonly body: string;
};

const REVIEW_COMMENT_KEYS: ReadonlySet<string> = new Set([
  'path',
  'line',
  'body',
  'start_line',
  'side',
]);

const POSITIVE_INT_RE = /^\d+$/;

const parsePositiveInt = (raw: string | undefined): number | null => {
  const trimmed = (raw ?? '').trim();
  if (!POSITIVE_INT_RE.test(trimmed)) {
    return null;
  }
  const value = Number.parseInt(trimmed, 10);
  return value > 0 ? value : null;
};

export const extractReviewComments = (
  assistantText: string,
): ReadonlyArray<ExtractedReviewComment> => {
  const out: ExtractedReviewComment[] = [];
  for (const inner of extractSelfClosingInner(assistantText, REVIEW_COMMENT_OPEN)) {
    const attrs = parseStrictQuotedAttrs(inner, REVIEW_COMMENT_KEYS);
    if (attrs === null) {
      continue;
    }
    const path = (attrs.path ?? '').trim();
    const body = (attrs.body ?? '').trim();
    const line = parsePositiveInt(attrs.line);
    if (path.length === 0 || body.length === 0 || line === null) {
      continue;
    }
    const startLine = attrs.start_line != null ? parsePositiveInt(attrs.start_line) : null;
    if (attrs.start_line != null && startLine === null) {
      continue;
    }
    const side = (attrs.side ?? 'new').trim();
    if (side !== 'new' && side !== 'old') {
      continue;
    }
    out.push({ path, line, startLine, side, body });
  }
  return out;
};

const STEP_DONE_RE = /<<step-done\s([^<>]*)>>/g;

export type ExtractedCluster = {
  readonly title: string;
  readonly instructions: string;
};

export const extractClustersFromMarker = (
  assistantText: string,
): ReadonlyArray<ExtractedCluster> | null => {
  const blocks = extractBlockContents(assistantText, CLUSTERS_OPEN, CLUSTERS_CLOSE);
  if (blocks.length === 0) {
    return null;
  }
  const raw = blocks[blocks.length - 1]!;

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
  let last: { id: string } | null = null;
  for (const inner of extractSelfClosingInner(assistantText, CLUSTER_DONE_OPEN)) {
    const attrs = parseHandoffAttrs(inner);
    const id = (attrs.id ?? '').trim();
    if (id.length === 0) {
      continue;
    }
    last = { id };
  }
  return last;
};

export const extractScoutDomains = (text: string): ReadonlyArray<string> | null => {
  let last: ReadonlyArray<string> | null = null;
  for (const inner of extractSelfClosingInner(text, SCOUT_DOMAINS_OPEN)) {
    const attrs = parseHandoffAttrs(inner);
    const domains = (attrs.keywords ?? '')
      .split(',')
      .map((keyword) => keyword.trim().toLowerCase())
      .filter((keyword) => keyword.length > 0 && SCOUT_DOMAIN_RE.test(keyword))
      .slice(0, 6);
    if (domains.length > 0) {
      last = domains;
    }
  }
  return last;
};

export const extractStepDone = (assistantText: string): { readonly id: string } | null => {
  STEP_DONE_RE.lastIndex = 0;
  let last: { id: string } | null = null;
  let m: RegExpExecArray | null;
  while ((m = STEP_DONE_RE.exec(assistantText)) !== null) {
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

export type ExtractedScoutArea = {
  readonly area: string;
  readonly query: string;
};

export const extractScoutSplit = (
  assistantText: string,
): ReadonlyArray<ExtractedScoutArea> | null => {
  const blocks = extractBlockContents(assistantText, SCOUT_SPLIT_OPEN, SCOUT_SPLIT_CLOSE);
  if (blocks.length === 0) {
    return null;
  }
  const raw = blocks[blocks.length - 1]!;

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

const FENCE_OPEN_RE = /^```(?:json)?/i;

function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const open = FENCE_OPEN_RE.exec(trimmed);
  if (open === null || !trimmed.endsWith('```') || trimmed.length < open[0].length + 3) {
    return trimmed;
  }
  return trimmed.slice(open[0].length, trimmed.length - 3).trim();
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
  const outsidePlan = stripBlocks(input.assistantText, PLAN_OPEN, PLAN_CLOSE).trim();
  if (PLAN_OPEN_QUESTION_RE.test(outsidePlan)) {
    return { ready: false, reason: 'has-open-question' };
  }
  return { ready: true, reason: null };
};

const BLOCK_MARKER_ALT =
  'plan|clusters|scout-split|workflow|goal|ctx-decision|ctx-resolved|ctx-question';
const SELF_MARKER_ALT =
  'handoff|comment-analysis|comment-resolved|comment-wontfix|review-comment|cluster-done|step-done|scout-domains';

const CONTROL_BLOCK_STRIP_RE = new RegExp(
  `<<(?:${BLOCK_MARKER_ALT})(?:\\s[^>]*)?>>[\\s\\S]*?<<\\/(?:${BLOCK_MARKER_ALT})>>`,
  'g',
);
const CONTROL_SELF_STRIP_RE = new RegExp(`<<(?:${SELF_MARKER_ALT})\\s[^>]*?>>`, 'g');
const CONTROL_OPEN_TAIL_RE = new RegExp(`<<(?:${BLOCK_MARKER_ALT})(?:\\s[^>]*)?>>[\\s\\S]*$`);
const CONTROL_PARTIAL_TAIL_RE = /<<?\/?[a-z-]*(?:\s[^>]*)?$/;

export const stripControlMarkers = (text: string): string => {
  CONTROL_BLOCK_STRIP_RE.lastIndex = 0;
  CONTROL_SELF_STRIP_RE.lastIndex = 0;
  return text
    .replace(CONTROL_BLOCK_STRIP_RE, '')
    .replace(CONTROL_SELF_STRIP_RE, '')
    .replace(CONTROL_OPEN_TAIL_RE, '')
    .replace(CONTROL_PARTIAL_TAIL_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};
