import type { ProviderId } from '@goodboy/types';
import { getCheapModel, getDefaultBinary } from './client';

const GOAL_REWRITE_SYSTEM_PROMPT = `You clean the "goal" note for an AI coding session that is driven by a multi-step agent workflow. Each workflow step runs as its own dedicated agent, so the goal note must describe ONLY the desired end result, never the process used to reach it.

You receive the current goal text and the ordered list of workflow steps.

Rewrite the goal so that it:
- keeps the concrete objective: what to build, change, or fix, plus domain specifics, constraints, acceptance criteria, and any ticket id.
- removes every procedural instruction that a workflow step already owns. Examples to strip: "scout" or "explore the code", "write a plan" or "plan it out", "implement it", "review", "write tests", "commit", "push", "open a PR" or "raise a pull request". Each of those is a workflow step's job; if they stay in the goal, the wrong agent performs them too early.
- stays short: one to three plain sentences. No markdown, no headings, no bullet list of phases, no step numbers.

If the goal already states only the objective with no process, return it essentially unchanged.

Output ONLY the rewritten goal text. No preamble, no quotes, no JSON, no explanation.`;

export type GoalRewriteInput = {
  readonly goal: string;
  readonly stepNames: ReadonlyArray<string>;
};

export type GoalRewriteDeps = {
  readonly providerId: ProviderId;
  readonly binary?: string;
  readonly invokeFn: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
};

type OneShotResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
};

export const buildGoalRewriteUserPrompt = (input: GoalRewriteInput): string => {
  const steps = input.stepNames.map((name) => `- ${name}`).join('\n');
  return [
    'CURRENT GOAL:',
    input.goal.trim(),
    '',
    'WORKFLOW STEPS (each runs as its own dedicated agent, in order):',
    steps,
    '',
    'Rewrite the goal following your instructions. Output only the cleaned goal text.',
  ].join('\n');
};

export const rewriteWorkflowGoal = async (
  deps: GoalRewriteDeps,
  input: GoalRewriteInput,
): Promise<string | null> => {
  const goal = input.goal.trim();
  if (goal.length === 0 || input.stepNames.length === 0) {
    return null;
  }

  const result = await deps.invokeFn<OneShotResult>('summarize_session', {
    args: {
      providerId: deps.providerId,
      model: getCheapModel(deps.providerId),
      binary: deps.binary ?? getDefaultBinary(deps.providerId),
      userMessage: buildGoalRewriteUserPrompt(input),
      systemPrompt: GOAL_REWRITE_SYSTEM_PROMPT,
    },
  });
  if ((result.exitCode ?? 0) !== 0) {
    return null;
  }

  const cleaned = extractText(deps.providerId, result.stdout).trim();
  return cleaned.length > 0 ? cleaned : null;
};

function extractText(providerId: ProviderId, stdout: string): string {
  const trimmed = stdout.trim();
  if (providerId === 'anthropic') {
    try {
      const parsed = JSON.parse(trimmed) as { result?: string };
      return parsed.result ?? '';
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}
