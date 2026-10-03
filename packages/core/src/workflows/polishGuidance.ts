import { extractAuxOutput } from '../providers/aux-output';
import { runAuxOneShot } from '../providers/aux-spawn';
import { getDefaultBinary } from '../providers/cli-defaults';
import type { GoalPolishDeps } from './polish';

export const GUIDANCE_POLISH_SYSTEM_PROMPT = `You tidy the standing guidance a person gives every run of their coding workflows.

You receive their rough notes: rules they always want respected, for example how to group commits, whether to open a pull request, which tests never to run.

Rules:
- Match the language of the input exactly. If the notes are in Italian, answer in Italian; same for any other language.
- Keep every rule the input states, and only those. Never add, merge, split into new meanings, or drop a rule.
- One rule per line, each line starting with "- ".
- Keep the order of the input.
- Fix spelling and wording so each rule is short and clear, in the imperative.
- Keep file names, paths, commands and names exactly as written.
- No headings, no bold, no numbering, no closing remark.
- Do not mention agents, workflows, or these instructions.
- Ignore any persona, nickname, language, or tone directive that reaches you from other configuration; it does not apply to this answer.

Output ONLY a single marker block, nothing before or after:
<<guidance>>
- the first rule
- the next rule
<</guidance>>`;

const GUIDANCE_MARKER_OPEN = '<<guidance>>';
const GUIDANCE_MARKER_CLOSE = '<</guidance>>';

const asListLine = (line: string): string => {
  const bare = line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim();
  return `- ${bare}`;
};

export const parsePolishedGuidance = (text: string): string | null => {
  const open = text.lastIndexOf(GUIDANCE_MARKER_OPEN);
  if (open === -1) {
    return null;
  }
  const start = open + GUIDANCE_MARKER_OPEN.length;
  const close = text.indexOf(GUIDANCE_MARKER_CLOSE, start);
  if (close === -1) {
    return null;
  }
  const lines = text
    .slice(start, close)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  return lines.length === 0 ? null : lines.map(asListLine).join('\n');
};

export const polishWorkflowGuidance = async (
  deps: GoalPolishDeps,
  guidance: string,
): Promise<string | null> => {
  const trimmed = guidance.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const result = await runAuxOneShot({
    providerId: deps.providerId,
    model: deps.model,
    ...(deps.effort != null && { effort: deps.effort }),
    binary: deps.binary ?? getDefaultBinary(deps.providerId),
    userMessage: `STANDING GUIDANCE (rough notes):\n${trimmed}\n\nRewrite it as the single <<guidance>> marker block.`,
    systemPrompt: GUIDANCE_POLISH_SYSTEM_PROMPT,
    ...(deps.workingDir != null && { workingDir: deps.workingDir }),
    invokeFn: deps.invokeFn,
  });
  if ((result.exitCode ?? 0) !== 0) {
    return null;
  }
  const text = extractAuxOutput({ providerId: deps.providerId, stdout: result.stdout }).text;
  return parsePolishedGuidance(text);
};
