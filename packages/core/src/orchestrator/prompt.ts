import { SLOT_BUDGETS } from '../context/budgets';
import { sessionLanguageRule } from '../language/sessionLanguage';
import {
  annotateFallbackStepOutputSummary,
  previewStepOutputSummary,
} from '../summarizer/step-output';
import { ROLE_REGISTRY, SELECTABLE_AGENT_ROLES } from '../roles';
import { roleNeedsSection } from '../roleNeeds';
import { formatWorkflowModelMenu } from './formatWorkflowModelMenu';
import type { OrchestratorInput } from './types';

const OLDER_SUMMARY_PREVIEW_LENGTH = 280;

const ORCHESTRATOR_ROLE_VOCABULARY = SELECTABLE_AGENT_ROLES.filter(
  (role) => ROLE_REGISTRY[role].workflowEligible,
).join(', ');

const ORCHESTRATOR_LANGUAGE_RULE = [
  sessionLanguageRule({
    goalLabel: 'the Goal in the request',
    writtenFields: ['name', 'promptPrefix', 'expectedOutput', 'reason', 'every run summary entry'],
  }),
  'role is not prose: it stays one of the canonical English keywords listed above, never translated and never renamed.',
  'promptPrefix is the instruction a step agent and the operator both read, so it carries the session language into the step you are creating. That inheritance is the only language signal a step or a sub-step gets: it never derives one of its own from the context handed to it.',
].join('\n');

type SystemPromptParams = {
  readonly isModelPickEnabled: boolean;
  readonly canReadFiles: boolean;
};

const NO_TOOLS_RULE =
  'You have no tools and no repository access, and you must not ask for either. Your only job is to emit the next decision from the information given.';

const READ_FILES_RULE =
  'You have one capability beyond the information given: reading files with Read, Glob and Grep. Use it only to open the files an operator hint names, such as attached images. You can never write, run commands, fetch from the web or ask for more tools. Your only job is to emit the next decision.';

const NO_TOOLS_RESPONSE = 'Respond immediately with exactly one marked JSON object';

const READ_FILES_RESPONSE =
  'Read the files the hints name first. Then respond with exactly one marked JSON object';

const DIFFICULTY_ROUTING_RULE =
  'Routing: you do not pick models. For every next step name taskType, one of exploration, planning, implementation, debugging, review, testing, writing, general, and difficulty, one of light, standard, heavy: how hard the work of this step is, judged from the goal, what the run found so far and how much the step has to change. The app turns the step role and your difficulty into the model and effort on the provider the operator prefers, a lighter model for light work and a stronger one for heavy work, so never name provider, model or effort. Put one clause on why the step has that difficulty in modelReason.';

const MODEL_ROUTING_RULE = `Routing: pick the model for every next step yourself. You know what the step has to do, so name provider, model and effort on the step, and say in one clause why that work needs that model. Every identity in the available models list is runnable right now, across every provider the operator connected, so a model outside the role defaults is a normal choice rather than a deviation you have to justify against configuration. Use provider and model exactly as listed, as a pair: the same model id can belong to two providers and they are not interchangeable. Set effort only to one of the levels listed for the model you picked, or omit it to take that model's own default. The role defaults are the fallback for a step you decline to route, not a ceiling on the ones you do. Add taskType, one of exploration, planning, implementation, debugging, review, testing, writing, general, and difficulty, one of light, standard, heavy, so the operator can see what the pick was made for, and put the routing sentence in modelReason.

The list names identities and the efforts each one accepts. It says nothing about how good a model is at anything: that judgement is yours, from what you know about these models, and you never claim a capability the list did not give you.`;

type RoutingParams = Pick<SystemPromptParams, 'isModelPickEnabled'>;

const routingSection = ({ isModelPickEnabled }: RoutingParams): string =>
  isModelPickEnabled ? MODEL_ROUTING_RULE : DIFFICULTY_ROUTING_RULE;

const stepRoutingFields = ({ isModelPickEnabled }: RoutingParams): string =>
  isModelPickEnabled ? '"provider":"...","model":"...","effort":"medium",' : '';

const orchestratorSystemPrompt = ({
  isModelPickEnabled,
  canReadFiles,
}: SystemPromptParams): string => `You are the workflow orchestrator for an AI coding workspace. You never execute the work yourself: dedicated agents run each step and report back. ${canReadFiles ? READ_FILES_RULE : NO_TOOLS_RULE}

After each completed step, including kickoff when no steps exist, decide the single next step or end the run. Keep steps small and purposeful. Most runs land in a handful of steps, so a long run has to be a deliberate choice you can justify in reason, never drift.

Flow rules, in this order of precedence:
1. From the goal and the operator process, estimate roughly how many steps this run should take and treat that estimate as your own soft cap. Exceed it only when what the run discovered justifies the extra work, and say so in reason. The run closes when the goal and the operator process are satisfied, never because a count was reached, and once they are satisfied you never keep going unless the operator explicitly asks for more.
2. Discovery, then a decision, then work. Unless the goal already names the files to change, is a located one-file fix, or the operator process says otherwise, the run starts with a scout or investigator step and the step after it is a planner step that turns those findings into the work to do. Do not go from discovery straight to an implementer.
3. Never reopen work a completed step already covers. If the gap left behind is small, return done and name that gap in the reason.
4. One review or test pass per implementation. Wanting a second review of the same work means the run should end.
5. Return done when the goal and the operator process are satisfied, when what is left needs the operator to decide, or when the process says to stop. Return blocked only when progress requires a human decision, never because you lack repository access.

Roles are limited to: ${ORCHESTRATOR_ROLE_VOCABULARY}. Use docs only for repository documentation, never for reports. Fixing review findings is implementer work.

${roleNeedsSection({ driver: 'orchestrator' })}

For a next step, promptPrefix is the instruction the step agent starts from and expectedOutput tells the post-step summarizer exactly what to extract.

When a step touches what an active decision governs, promptPrefix names that decision by number and restates its rule in one line, so the step never depends on finding it.

${routingSection({ isModelPickEnabled })}

reason is written for the operator, not for you. Say why this step is needed now: what the step before it left open, what this one settles. One or two sentences, plain markdown, never a recap of what already happened. For done and blocked, say what the run achieved and what is left.

${ORCHESTRATOR_LANGUAGE_RULE}

${canReadFiles ? READ_FILES_RESPONSE : NO_TOOLS_RESPONSE} on a single line, using \\n escapes for any newlines inside strings, and nothing else:
<<orchestrator>>{"action":"next","reason":"...","step":{"name":"...","role":"implementer","promptPrefix":"...","expectedOutput":"...",${stepRoutingFields({ isModelPickEnabled })}"taskType":"implementation","difficulty":"standard","modelReason":"..."}}<</orchestrator>>

The other valid forms are:
<<orchestrator>>{"action":"done","reason":"..."}<</orchestrator>>
<<orchestrator>>{"action":"blocked","reason":"..."}<</orchestrator>>

After the decision, on its own line, emit the running recap of the whole run as one JSON object on a single line:
<<run-summary>>{"done":["one entry per thing the run has actually landed"],"left":["one entry per thing still open",{"text":"a thing still open that a later step would settle","role":"tester"}]}<</run-summary>>

Each entry is one short sentence of plain text, no markdown and no bullet glyphs. A left entry you expect a later step to settle is an object with that sentence as text and the role you expect to run it, one of the role keywords above; leave it a plain string when no step is planned for it. An empty left array means the run is complete. The recap is written for the operator, it replaces the previous one every time, and it covers the run so far rather than only the step you just decided. Emit it with every decision, including done and blocked.`;

export const ORCHESTRATOR_SYSTEM_PROMPT = orchestratorSystemPrompt({
  isModelPickEnabled: false,
  canReadFiles: false,
});

export const ORCHESTRATOR_MODEL_PICK_SYSTEM_PROMPT = orchestratorSystemPrompt({
  isModelPickEnabled: true,
  canReadFiles: false,
});

const ORCHESTRATOR_READING_SYSTEM_PROMPT = orchestratorSystemPrompt({
  isModelPickEnabled: false,
  canReadFiles: true,
});

const ORCHESTRATOR_MODEL_PICK_READING_SYSTEM_PROMPT = orchestratorSystemPrompt({
  isModelPickEnabled: true,
  canReadFiles: true,
});

type SystemPromptForParams = {
  readonly input: Pick<OrchestratorInput, 'isModelPickEnabled' | 'canReadFiles'>;
};

export const orchestratorSystemPromptFor = ({ input }: SystemPromptForParams): string => {
  const isPick = input.isModelPickEnabled === true;
  if (input.canReadFiles === true) {
    return isPick
      ? ORCHESTRATOR_MODEL_PICK_READING_SYSTEM_PROMPT
      : ORCHESTRATOR_READING_SYSTEM_PROMPT;
  }
  return isPick ? ORCHESTRATOR_MODEL_PICK_SYSTEM_PROMPT : ORCHESTRATOR_SYSTEM_PROMPT;
};

type RoleModelSetLinesParams = {
  readonly roleDefaults: OrchestratorInput['roleDefaults'];
};

const roleModelSetLines = ({ roleDefaults }: RoleModelSetLinesParams): ReadonlyArray<string> => {
  const withSets = roleDefaults.filter(
    (entry) => entry.models !== undefined && entry.models.length > 0,
  );
  if (withSets.length === 0) {
    return [];
  }
  return [
    '',
    'Role model sets (a step of these roles runs only on one of its listed models, pick by the size of the work):',
    ...withSets.map(
      (entry) =>
        `${entry.role}: ${(entry.models ?? []).map((model) => `${model.provider}/${model.model}`).join(', ')}`,
    ),
  ];
};

type SkippedPinLinesParams = {
  readonly roleDefaults: OrchestratorInput['roleDefaults'];
};

const skippedPinLines = ({ roleDefaults }: SkippedPinLinesParams): ReadonlyArray<string> => {
  const skipped = roleDefaults.filter((entry) => entry.skippedPin !== undefined);
  if (skipped.length === 0) {
    return [];
  }
  return [
    '',
    'Pinned models that cannot run (the role default above runs instead):',
    ...skipped.map((entry) => `${entry.role}: ${entry.skippedPin ?? ''}`),
  ];
};

const DIFFICULTY_ROUTING_LINES: ReadonlyArray<string> = [
  '',
  'Models: the app picks the model and effort of every step from its role and the difficulty you name, on the provider the operator prefers. Name taskType and difficulty for the work itself and leave provider, model and effort out.',
];

type ModelPickLinesParams = Pick<
  OrchestratorInput,
  'modelMenu' | 'roleDefaults' | 'providerId' | 'isModelMetadataEnabled'
>;

const modelPickLines = ({
  modelMenu,
  roleDefaults,
  providerId,
  isModelMetadataEnabled,
}: ModelPickLinesParams): ReadonlyArray<string> => {
  const lines = [
    '',
    'Available models, provider and model id and the efforts that model accepts. Automatic steps can use your connected providers:',
  ];
  if (modelMenu.length === 0) {
    lines.push('(none, omit provider, model and effort)');
  } else if (isModelMetadataEnabled === true) {
    lines.push(
      formatWorkflowModelMenu({ options: modelMenu }),
      '',
      'Name taskType and difficulty for the work itself, not for the model you want. modelReason justifies the routing pick in one clause and never replaces reason, which stays about the work the step does.',
    );
  } else {
    modelMenu.forEach((option) => {
      const efforts = option.efforts.length === 0 ? 'no effort control' : option.efforts.join(', ');
      lines.push(`${option.provider}/${option.model} - ${option.label} - efforts: ${efforts}`);
    });
  }
  lines.push(
    '',
    `You are running on ${providerId}. That says nothing about which provider a step should run on.`,
    '',
    'Role defaults (the fallback for a step you leave unrouted):',
    roleDefaults.length === 0
      ? '(none)'
      : roleDefaults
          .map((entry) => `${entry.role}=${entry.provider}/${entry.model}/${entry.effort}`)
          .join(', '),
    ...roleModelSetLines({ roleDefaults }),
    ...skippedPinLines({ roleDefaults }),
  );
  return lines;
};

const PRESET_CLOSENESS_LABEL = {
  follow: 'Follow the preset',
  adapt: 'Adapt as it goes',
} as const;

const PRESET_RULES = {
  follow: [
    'Do not add, skip or move a step on your own. When a finding asks for a step the preset lacks, a step\'s work is already done, or a step should come earlier, still emit that decision and name the change in "change": the operator is asked before anything changes, and an approved change comes back as a hint.',
  ],
  adapt: [
    'Add a step when a finding asks for it, skip a step whose work is already done, and move a step that has not started. Name every such change in "change" with its reason.',
  ],
} as const;

type OneLineParams = {
  readonly text: string;
};

const oneLineOf = ({ text }: OneLineParams): string =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .join(' ');

type PresetLinesParams = {
  readonly preset: NonNullable<OrchestratorInput['preset']>;
};

const presetLines = ({ preset }: PresetLinesParams): ReadonlyArray<string> => [
  `Preset: ${preset.name}, ${PRESET_CLOSENESS_LABEL[preset.closeness]}. Its steps, in order (put the number of the step you run in "presetStep"):`,
  ...preset.steps.flatMap((step, index) => {
    const instructions = oneLineOf({ text: step.instructions });
    return [
      `${index + 1}. ${step.role ?? 'agent'}: ${step.name}${step.isPinned ? ' (pinned: run it as written, never skip or move it)' : ''}`,
      ...(instructions === '' ? [] : [`   Instructions: ${instructions}`]),
    ];
  }),
  '',
  'Rules for the preset:',
  '- Run the steps in order, writing each brief from the step, its instructions and the goal.',
  ...PRESET_RULES[preset.closeness].map((rule) => `- ${rule}`),
  '- The goal, the operator process and the hints rank above the preset. Never change a pinned step.',
  '- Never start work past the spend limit, push, open or merge a pull request.',
  '- A change is one field on the decision: "change":{"kind":"added|skipped|reordered","step":"<the step\'s name>","reason":"<one sentence for the operator>"}. Leave it out when the decision runs the preset as written.',
  ...(preset.changes.length > 0
    ? [
        '',
        'Changes made so far:',
        ...preset.changes.map((change) => `- ${change.kind}: ${change.step} (${change.reason})`),
      ]
    : []),
  '',
];

type DecisionsParams = {
  readonly decisions: string;
};

const budgetedDecisions = ({ decisions }: DecisionsParams): string => {
  const kept: Array<string> = [];
  let used = 0;
  for (const row of decisions.split(/\n(?=- D\d)/)) {
    if (used + row.length > SLOT_BUDGETS.decisions && kept.length > 0) {
      break;
    }
    kept.push(row);
    used += row.length + 1;
  }
  return kept.join('\n').slice(0, SLOT_BUDGETS.decisions);
};

export const buildOrchestratorUserPrompt = ({
  goal,
  processText,
  completedSteps,
  openQuestionCount,
  operatorHints,
  decisions,
  providerId,
  modelMenu,
  roleDefaults,
  stepsUsed,
  isModelMetadataEnabled,
  isModelPickEnabled,
  spendLimitUsd,
  spentUsd,
  preset,
}: OrchestratorInput): string => {
  const process = processText.trim();
  const lines = [
    'Goal (the session language is the language this is written in):',
    goal.trim(),
    '',
    ...(process.length > 0 ? ['Operator process:', process, ''] : []),
    ...(preset === undefined ? [] : presetLines({ preset })),
    `Open questions: ${openQuestionCount}`,
    '',
    `Steps used: ${stepsUsed}`,
  ];
  if (spendLimitUsd != null) {
    lines.push(
      `Spend: $${(spentUsd ?? 0).toFixed(2)} of the $${spendLimitUsd.toFixed(2)} the operator allowed. As you approach it, consolidate what is left into fewer steps.`,
    );
  }
  lines.push(
    ...(isModelPickEnabled === true
      ? modelPickLines({ modelMenu, roleDefaults, providerId, isModelMetadataEnabled })
      : DIFFICULTY_ROUTING_LINES),
    '',
    'Completed steps (their summaries are written in English by contract, which says nothing about the language you answer in):',
  );
  if (completedSteps.length === 0) {
    lines.push('(none)');
  } else {
    completedSteps.forEach((step, index) => {
      const summary = step.outputSummary?.trim() ?? '';
      const isLatest = index === completedSteps.length - 1;
      const rendered = isLatest
        ? annotateFallbackStepOutputSummary({ summary })
        : previewStepOutputSummary({ summary, length: OLDER_SUMMARY_PREVIEW_LENGTH });
      lines.push(
        `${index + 1}. ${step.name}`,
        rendered.length > 0 ? rendered : '(no output captured)',
      );
    });
  }
  const activeDecisions = budgetedDecisions({ decisions: decisions?.trim() ?? '' });
  if (activeDecisions.length > 0) {
    lines.push(
      '',
      'Active decisions of the session, newest first (name the number in a step promptPrefix when the step touches one):',
      activeDecisions,
    );
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
