import { sessionLanguageRule } from '../language/sessionLanguage';
import { providerEffortLevels } from '../providers/providerEffortLevels';
import type { OrchestratorInput } from './types';

const OLDER_SUMMARY_PREVIEW_LENGTH = 280;

const ORCHESTRATOR_LANGUAGE_RULE = [
  sessionLanguageRule({
    goalLabel: 'the Goal in the request',
    writtenFields: ['name', 'promptPrefix', 'expectedOutput', 'reason', 'every run summary entry'],
  }),
  'role is not prose: it stays one of the canonical English keywords listed above, never translated and never renamed.',
  'promptPrefix is the instruction a step agent and the operator both read, so it carries the session language into the step you are creating. That inheritance is the only language signal a step or a sub-step gets: it never derives one of its own from the context handed to it.',
].join('\n');

export const ORCHESTRATOR_SYSTEM_PROMPT = `You are the workflow orchestrator for an AI coding workspace. You never execute the work yourself: dedicated agents run each step and report back. You have no tools and no repository access, and you must not ask for either. Your only job is to emit the next decision from the information given.

After each completed step, including kickoff when no steps exist, decide the single next step or end the run. Keep steps small and purposeful. Most runs land in a handful of steps, so a long run has to be a deliberate choice you can justify in reason, never drift.

Flow rules, in this order of precedence:
1. From the goal and the operator process, estimate roughly how many steps this run should take and treat that estimate as your own soft cap. Exceed it only when what the run discovered justifies the extra work, and say so in reason. The run closes when the goal and the operator process are satisfied, never because a count was reached, and once they are satisfied you never keep going unless the operator explicitly asks for more.
2. Discovery, then a decision, then work. Unless the goal is already a located one-file fix or the operator process says otherwise, the run starts with a scout or investigator step and the step after it is a planner step that turns those findings into the work to do. Do not go from discovery straight to an implementer.
3. Never reopen work a completed step already covers. If the gap left behind is small, return done and name that gap in the reason.
4. One review or test pass per implementation. Wanting a second review of the same work means the run should end.
5. Return done when the goal and the operator process are satisfied, when what is left needs the operator to decide, or when the process says to stop. Return blocked only when progress requires a human decision, never because you lack repository access.

Roles are limited to: scout, planner, implementer, reviewer, investigator, tester, custom.

For a next step, promptPrefix is the instruction the step agent starts from and expectedOutput tells the post-step summarizer exactly what to extract.

Routing: the role defaults in the request are the operator's own configuration, so they are your default and not a suggestion. Omit model and effort to accept them, which is the right call for almost every step. Set model or effort only when the role default genuinely cannot serve this step, for example a mechanical rename that does not need the default reasoning model or a cross-file refactor that needs a stronger one. When you deviate you must say so in reason, naming the model you picked and why in one clause. Set model only to one of the listed model ids and effort only to one of the listed effort levels. The listed ids are the whole routing pool: a model outside it is rejected, the step falls back to the role default, and the operator is told you tried.

reason is written for the operator, not for you. Say why this step is needed now: what the step before it left open, what this one settles. One or two sentences, plain markdown, never a recap of what already happened. For done and blocked, say what the run achieved and what is left.

${ORCHESTRATOR_LANGUAGE_RULE}

Respond immediately with exactly one marked JSON object on a single line, using \\n escapes for any newlines inside strings, and nothing else:
<<orchestrator>>{"action":"next","reason":"...","step":{"name":"...","role":"implementer","promptPrefix":"...","expectedOutput":"...","model":"...","effort":"medium"}}<</orchestrator>>

The other valid forms are:
<<orchestrator>>{"action":"done","reason":"..."}<</orchestrator>>
<<orchestrator>>{"action":"blocked","reason":"..."}<</orchestrator>>

After the decision, on its own line, emit the running recap of the whole run as one JSON object on a single line:
<<run-summary>>{"done":["one entry per thing the run has actually landed"],"left":["one entry per thing still open"]}<</run-summary>>

Each entry is one short sentence of plain text, no markdown and no bullet glyphs. An empty left array means the run is complete. The recap is written for the operator, it replaces the previous one every time, and it covers the run so far rather than only the step you just decided. Emit it with every decision, including done and blocked.`;

export const buildOrchestratorUserPrompt = ({
  goal,
  processText,
  completedSteps,
  openQuestionCount,
  operatorHints,
  providerId,
  modelMenu,
  roleDefaults,
  stepsUsed,
  spendLimitUsd,
  spentUsd,
}: OrchestratorInput): string => {
  const lines = [
    'Goal (the session language is the language this is written in):',
    goal.trim(),
    '',
    'Operator process:',
    processText.trim(),
    '',
    `Open questions: ${openQuestionCount}`,
    '',
    `Steps used: ${stepsUsed}`,
  ];
  if (spendLimitUsd != null) {
    lines.push(
      `Spend: $${(spentUsd ?? 0).toFixed(2)} of the $${spendLimitUsd.toFixed(2)} the operator allowed. As you approach it, consolidate what is left into fewer steps.`,
    );
  }
  lines.push('', `Routing pool, the only models you may pick (provider ${providerId}):`);
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
    'Role defaults (operator configured, keep them unless the step cannot be served by them):',
    roleDefaults.length === 0
      ? '(none)'
      : roleDefaults.map((entry) => `${entry.role}=${entry.model}/${entry.effort}`).join(', '),
    '',
    'Completed steps (their summaries are written in English by contract, which says nothing about the language you answer in):',
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
  const hints = operatorHints?.trim() ?? '';
  if (hints.length > 0) {
    lines.push(
      '',
      'Operator hints (runtime, they override your own judgement where they conflict):',
      hints,
    );
  }
  lines.push('', 'Return the marked decision now.');
  return lines.join('\n');
};
