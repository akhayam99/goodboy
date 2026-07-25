import type { ProviderId } from '@goodboy/types';
import { extractAuxOutput } from '../providers/aux-output';
import { getCheapModel, getDefaultBinary } from '../providers/cli-defaults';

const STEP_POLISH_SYSTEM_PROMPT = `You polish step instructions for AI coding workflows.

A workflow is an ordered list of steps; each step is run by one coding agent. You receive a single step's rough, hand-written instruction plus its role and name. Rewrite the instruction so the agent for that step knows exactly what to do and what to hand off to the next step.

Rules:
- Match the language of the input instruction exactly. If it is written in Italian, write the polished instruction in Italian; same for any other language.
- Preserve every concrete detail: file names, paths, feature names, constraints, do-not items.
- Imperative voice, two to four sentences. No preamble, no sign-off.
- Stay within the step's role. A scout surveys and does not change code; a planner plans and does not write code; an implementer writes code; a tester writes and runs tests. Do not blur these boundaries.
- Do not invent requirements, scope, or constraints that are not implied by the input.
- Do not mention agents, workflows, roles, or these instructions in the output.

Output ONLY a single marker block, nothing before or after:
<<step>>
the polished instruction text
<</step>>

Plain text inside the block. No markdown, no quotes, no trailing prose.`;

export type StepPolishDeps = {
  readonly providerId: ProviderId;
  readonly binary?: string;
  readonly workingDir?: string;
  readonly invokeFn: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
};

export type StepPolishInput = {
  readonly role: string;
  readonly name: string;
  readonly instruction: string;
};

type OneShotResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
};

export const polishStepInstruction = async (
  deps: StepPolishDeps,
  input: StepPolishInput,
): Promise<string | null> => {
  const trimmed = input.instruction.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const userMessage = [
    `STEP ROLE: ${input.role}`,
    `STEP NAME: ${input.name}`,
    '',
    `INSTRUCTION (rough draft):\n${trimmed}`,
    '',
    'Rewrite it as the single <<step>> marker block.',
  ].join('\n');

  const result = await deps.invokeFn<OneShotResult>('summarize_session', {
    args: {
      providerId: deps.providerId,
      model: getCheapModel(deps.providerId),
      binary: deps.binary ?? getDefaultBinary(deps.providerId),
      userMessage,
      systemPrompt: STEP_POLISH_SYSTEM_PROMPT,
      ...(deps.workingDir != null && { workingDir: deps.workingDir }),
    },
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
