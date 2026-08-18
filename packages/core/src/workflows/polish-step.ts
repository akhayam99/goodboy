import type { TaskModelPreference } from '@goodboy/types';
import { sessionLanguageRule } from '../language/sessionLanguage';
import { extractAuxOutput } from '../providers/aux-output';
import { runAuxOneShot } from '../providers/aux-spawn';
import { getDefaultBinary } from '../providers/cli-defaults';

const STEP_POLISH_RULES = `You polish step instructions for AI coding workflows.

A workflow is an ordered list of steps; each step is run by one coding agent. You receive a single step's rough, hand-written instruction plus its role and name. Rewrite the instruction so the agent for that step knows exactly what to do and what to hand off to the next step.

Rules:
- Preserve every concrete detail: file names, paths, feature names, constraints, do-not items.
- Imperative voice, two to four sentences. No preamble, no sign-off.
- Stay within the step's role. A scout surveys and does not change code; a planner plans and does not write code; an implementer writes code; a tester writes and runs tests. Do not blur these boundaries.
- Do not invent requirements, scope, or constraints that are not implied by the input.
- Do not mention agents, workflows, roles, or these instructions in the output.`;

const STEP_POLISH_OUTPUT_CONTRACT = `Output ONLY a single marker block, nothing before or after:
<<step>>
the polished instruction text
<</step>>

Plain text inside the block. No markdown, no quotes, no trailing prose.`;

const stepPolishSystemPrompt = ({ hasGoal }: { readonly hasGoal: boolean }): string =>
  [
    STEP_POLISH_RULES,
    '',
    sessionLanguageRule({
      goalLabel: hasGoal ? 'the WORKFLOW GOAL in the request' : 'the rough draft instruction',
      writtenFields: ['the polished instruction'],
    }),
    '',
    STEP_POLISH_OUTPUT_CONTRACT,
  ].join('\n');

export type StepPolishDeps = TaskModelPreference & {
  readonly binary?: string;
  readonly workingDir?: string;
  readonly invokeFn: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
};

export type StepPolishInput = {
  readonly role: string;
  readonly name: string;
  readonly instruction: string;
  readonly goal?: string;
};

export const buildStepPolishUserPrompt = ({
  role,
  name,
  instruction,
  goal,
}: StepPolishInput): string => {
  const trimmedGoal = goal?.trim() ?? '';
  return [
    `STEP ROLE: ${role}`,
    `STEP NAME: ${name}`,
    '',
    ...(trimmedGoal.length > 0 ? [`WORKFLOW GOAL:\n${trimmedGoal}`, ''] : []),
    `INSTRUCTION (rough draft):\n${instruction.trim()}`,
    '',
    'Rewrite it as the single <<step>> marker block.',
  ].join('\n');
};

export const polishStepInstruction = async (
  deps: StepPolishDeps,
  input: StepPolishInput,
): Promise<string | null> => {
  const trimmed = input.instruction.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const result = await runAuxOneShot({
    providerId: deps.providerId,
    model: deps.model,
    ...(deps.effort != null && { effort: deps.effort }),
    binary: deps.binary ?? getDefaultBinary(deps.providerId),
    userMessage: buildStepPolishUserPrompt(input),
    systemPrompt: stepPolishSystemPrompt({ hasGoal: (input.goal?.trim() ?? '').length > 0 }),
    ...(deps.workingDir != null && { workingDir: deps.workingDir }),
    invokeFn: deps.invokeFn,
  });
  if ((result.exitCode ?? 0) !== 0) {
    return null;
  }

  const text = extractAuxOutput({ providerId: deps.providerId, stdout: result.stdout }).text;
  return parsePolishedStep(text);
};

const STEP_MARKER_OPEN = '<<step>>';
const STEP_MARKER_CLOSE = '<</step>>';

export const parsePolishedStep = (text: string): string | null => {
  let body: string | null = null;
  let from = 0;
  for (;;) {
    const open = text.indexOf(STEP_MARKER_OPEN, from);
    if (open === -1) {
      break;
    }
    const contentStart = open + STEP_MARKER_OPEN.length;
    const close = text.indexOf(STEP_MARKER_CLOSE, contentStart);
    if (close === -1) {
      break;
    }
    const inner = text.slice(contentStart, close).trim();
    if (inner.length > 0) {
      body = inner;
    }
    from = close + STEP_MARKER_CLOSE.length;
  }
  if (body !== null) {
    return body;
  }
  const fallback = text.trim();
  return fallback.length > 0 && !fallback.includes(STEP_MARKER_OPEN) ? fallback : null;
};
