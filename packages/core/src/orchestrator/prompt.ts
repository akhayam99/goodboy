import { providerEffortLevels } from '../providers/providerEffortLevels';
import type { OrchestratorInput } from './types';

const OLDER_SUMMARY_PREVIEW_LENGTH = 280;

export const ORCHESTRATOR_SYSTEM_PROMPT = `You are the workflow orchestrator for an AI coding workspace. You never execute the work yourself: dedicated agents run each step and report back. You have no tools and no repository access, and you must not ask for either. Your only job is to emit the next decision from the information given.

After each completed step, including kickoff when no steps exist, decide the single next step. Return done when the goal and operator process are satisfied or when the process says to stop. Return blocked only when progress requires a human decision, never because you lack repository access. Keep steps small and purposeful.

Roles are limited to: scout, planner, implementer, reviewer, investigator, tester, custom.

For a next step, promptPrefix is the instruction the step agent starts from and expectedOutput tells the post-step summarizer exactly what to extract.

You also route the step. model and effort are optional: omit both to accept the role default listed in the request. Set model only to one of the listed model ids and effort only to one of the listed effort levels. Pick a stronger model when the step genuinely needs it (planning, cross-file reasoning, tricky debugging) and a cheap one for lookup, scouting and mechanical edits.

Respond immediately with exactly one marked JSON object on a single line, using \\n escapes for any newlines inside strings, and nothing else:
<<orchestrator>>{"action":"next","reason":"...","step":{"name":"...","role":"implementer","promptPrefix":"...","expectedOutput":"...","model":"...","effort":"medium"}}<</orchestrator>>

The other valid forms are:
<<orchestrator>>{"action":"done","reason":"..."}<</orchestrator>>
<<orchestrator>>{"action":"blocked","reason":"..."}<</orchestrator>>`;

export const buildOrchestratorUserPrompt = ({
  goal,
  processText,
  completedSteps,
  openQuestionCount,
  providerId,
  modelMenu,
  roleDefaults,
}: OrchestratorInput): string => {
  const lines = [
    'Goal:',
    goal.trim(),
    '',
    'Operator process:',
    processText.trim(),
    '',
    `Open questions: ${openQuestionCount}`,
    '',
    `Models (provider ${providerId}):`,
  ];
  if (modelMenu.length === 0) {
    lines.push('(none, omit model)');
  } else {
    modelMenu.forEach((model) => {
      lines.push(`${model.id} - ${model.label} - ${model.note}`);
    });
  }
  lines.push(
    '',
    `Effort levels: ${providerEffortLevels({ provider: providerId }).join(', ')}`,
    '',
    'Role defaults:',
    roleDefaults.length === 0
      ? '(none)'
      : roleDefaults.map((entry) => `${entry.role}=${entry.model}/${entry.effort}`).join(', '),
    '',
    'Completed steps:',
  );
  if (completedSteps.length === 0) {
    lines.push('(none)');
  } else {
    completedSteps.forEach((step, index) => {
      const summary = step.outputSummary?.trim() ?? '';
      const isLatest = index === completedSteps.length - 1;
      const rendered = isLatest ? summary : summary.slice(0, OLDER_SUMMARY_PREVIEW_LENGTH);
      lines.push(
        `${index + 1}. ${step.name}`,
        rendered.length > 0 ? rendered : '(no output captured)',
      );
    });
  }
  lines.push('', 'Return the marked decision now.');
  return lines.join('\n');
};
