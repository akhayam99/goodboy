import type { PlannerOutput, PlannerStep } from './types';

export class PlannerParseError extends Error {
  constructor(
    message: string,
    public readonly raw: string,
  ) {
    super(message);
    this.name = 'PlannerParseError';
  }
}

export const parsePlannerOutput = (raw: string): PlannerOutput => {
  const stripped = stripCodeFences(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    const extracted = extractJsonObject(stripped);
    if (extracted) {
      try {
        parsed = JSON.parse(extracted);
      } catch (innerErr) {
        throw new PlannerParseError(
          `planner response contained invalid JSON: ${innerErr instanceof Error ? innerErr.message : String(innerErr)}`,
          raw,
        );
      }
    } else {
      throw new PlannerParseError(
        'planner returned plain text instead of JSON. try again or rephrase in English.',
        raw,
      );
    }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new PlannerParseError('planner response was not a JSON object', raw);
  }
  const obj = parsed as Record<string, unknown>;

  const workflowName = obj.workflowName;
  if (typeof workflowName !== 'string' || workflowName.trim().length === 0) {
    throw new PlannerParseError('planner response missing or empty "workflowName"', raw);
  }

  const reasoning = obj.reasoning;
  if (typeof reasoning !== 'string') {
    throw new PlannerParseError('planner response missing "reasoning" string', raw);
  }

  const stepsRaw = obj.steps;
  if (!Array.isArray(stepsRaw)) {
    throw new PlannerParseError('planner response "steps" was not an array', raw);
  }
  if (stepsRaw.length === 0) {
    throw new PlannerParseError('planner response "steps" must contain at least one step', raw);
  }

  const steps: PlannerStep[] = [];
  for (const [index, entry] of stepsRaw.entries()) {
    if (typeof entry !== 'object' || entry === null) {
      throw new PlannerParseError(`planner step at index ${index} is not an object`, raw);
    }
    const e = entry as Record<string, unknown>;
    const name = e.name;
    const role = e.role;
    const promptPrefix = e.promptPrefix;
    const expectedOutput = e.expectedOutput;
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new PlannerParseError(`planner step at index ${index} missing "name"`, raw);
    }
    if (typeof role !== 'string' || role.trim().length === 0) {
      throw new PlannerParseError(`planner step at index ${index} missing "role"`, raw);
    }
    if (typeof promptPrefix !== 'string') {
      throw new PlannerParseError(`planner step at index ${index} missing "promptPrefix"`, raw);
    }
    if (typeof expectedOutput !== 'string') {
      throw new PlannerParseError(`planner step at index ${index} missing "expectedOutput"`, raw);
    }
    steps.push({ name, role, promptPrefix, expectedOutput });
  }

  return {
    workflowName: workflowName.trim(),
    reasoning,
    steps,
  };
};

function stripCodeFences(raw: string): string {
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(raw.trim());
  return (fenced?.[1] ?? raw).trim();
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}
