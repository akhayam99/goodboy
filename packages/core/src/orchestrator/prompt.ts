import type { OrchestratorInput } from './types';

const OLDER_SUMMARY_PREVIEW_LENGTH = 280;

export const ORCHESTRATOR_SYSTEM_PROMPT = `You are the workflow orchestrator for an AI coding workspace.

After each completed step, including kickoff when no steps exist, decide the single next step. Return done when the goal and operator process are satisfied or when the process says to stop. Return blocked when progress requires human input. Keep steps small and purposeful.

Roles are limited to: scout, planner, implementer, reviewer, investigator, tester, custom.

For a next step, expectedOutput tells the post-step summarizer exactly what to extract.

Respond with exactly one marked JSON object:
<<orchestrator>>{"action":"next","reason":"...","step":{"name":"...","role":"implementer","promptPrefix":"...","expectedOutput":"..."}}<</orchestrator>>

The other valid forms are:
<<orchestrator>>{"action":"done","reason":"..."}<</orchestrator>>
<<orchestrator>>{"action":"blocked","reason":"..."}<</orchestrator>>`;

export const buildOrchestratorUserPrompt = ({
  goal,
  processText,
  completedSteps,
  openQuestionCount,
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
    'Completed steps:',
  ];
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
