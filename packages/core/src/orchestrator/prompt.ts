import { sessionLanguageRule } from '../language/sessionLanguage';
import {
  annotateFallbackStepOutputSummary,
  previewStepOutputSummary,
} from '../summarizer/step-output';
import { ROLE_REGISTRY, SELECTABLE_AGENT_ROLES } from '../roles';
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

export const ORCHESTRATOR_SYSTEM_PROMPT = `You are the workflow orchestrator for an AI coding workspace. You never execute the work yourself: dedicated agents run each step and report back. You have no tools and no repository access, and you must not ask for either. Your only job is to emit the next decision from the information given.

After each completed step, including kickoff when no steps exist, decide the single next step or end the run. Keep steps small and purposeful. Most runs land in a handful of steps, so a long run has to be a deliberate choice you can justify in reason, never drift.

Flow rules, in this order of precedence:
1. From the goal and the operator process, estimate roughly how many steps this run should take and treat that estimate as your own soft cap. Exceed it only when what the run discovered justifies the extra work, and say so in reason. The run closes when the goal and the operator process are satisfied, never because a count was reached, and once they are satisfied you never keep going unless the operator explicitly asks for more.
2. Discovery, then a decision, then work. Unless the goal is already a located one-file fix or the operator process says otherwise, the run starts with a scout or investigator step and the step after it is a planner step that turns those findings into the work to do. Do not go from discovery straight to an implementer.
3. Never reopen work a completed step already covers. If the gap left behind is small, return done and name that gap in the reason.
4. One review or test pass per implementation. Wanting a second review of the same work means the run should end.
5. Return done when the goal and the operator process are satisfied, when what is left needs the operator to decide, or when the process says to stop. Return blocked only when progress requires a human decision, never because you lack repository access.

Roles are limited to: ${ORCHESTRATOR_ROLE_VOCABULARY}. Use docs only for repository documentation, never for reports. Use resolver only when the goal supplies concrete review threads.

For a next step, promptPrefix is the instruction the step agent starts from and expectedOutput tells the post-step summarizer exactly what to extract.

Routing: pick the model for every next step yourself. You know what the step has to do, so name provider, model and effort on the step, and say in one clause why that work needs that model. Every identity in the available models list is runnable right now, across every provider the operator connected, so a model outside the role defaults is a normal choice rather than a deviation you have to justify against configuration. Use provider and model exactly as listed, as a pair: the same model id can belong to two providers and they are not interchangeable. Set effort only to one of the levels listed for the model you picked, or omit it to take that model's own default. The role defaults are the fallback for a step you decline to route, not a ceiling on the ones you do. Add taskType, one of exploration, planning, implementation, debugging, review, testing, writing, general, and difficulty, one of light, standard, heavy, so the operator can see what the pick was made for, and put the routing sentence in modelReason.

The list names identities and the efforts each one accepts. It says nothing about how good a model is at anything: that judgement is yours, from what you know about these models, and you never claim a capability the list did not give you.

reason is written for the operator, not for you. Say why this step is needed now: what the step before it left open, what this one settles. One or two sentences, plain markdown, never a recap of what already happened. For done and blocked, say what the run achieved and what is left.

${ORCHESTRATOR_LANGUAGE_RULE}

Respond immediately with exactly one marked JSON object on a single line, using \\n escapes for any newlines inside strings, and nothing else:
<<orchestrator>>{"action":"next","reason":"...","step":{"name":"...","role":"implementer","promptPrefix":"...","expectedOutput":"...","provider":"...","model":"...","effort":"medium","taskType":"implementation","difficulty":"standard","modelReason":"..."}}<</orchestrator>>

The other valid forms are:
<<orchestrator>>{"action":"done","reason":"..."}<</orchestrator>>
<<orchestrator>>{"action":"blocked","reason":"..."}<</orchestrator>>

When the request carries a pending capability need, that need is the decision. Answer it with action need, naming the obligation id exactly as given, and pick one disposition:
- grant: the gap is real and nothing already answers it. Emit the step as the requested role and purpose. A grant creates at most one task, so ask for the single agent that closes the need.
- reuse: the evidence listed already answers the question. Name the source ids you are answering with in evidenceRefs, and the requester receives them instead of an agent.
- attach: work already running carries the same obligation, so the requester waits for that owner rather than a second one.
- refine: the question is too broad, or the gap it claims is not established by the evidence. Say in reason what a usable request would have to narrow.
- refuse: the need is not warranted. reason reaches the requester, so write it for them.

<<orchestrator>>{"action":"need","reason":"...","obligationId":"...","disposition":{"kind":"grant","step":{"name":"...","role":"implementer","promptPrefix":"...","expectedOutput":"..."}}}<</orchestrator>>
<<orchestrator>>{"action":"need","reason":"...","obligationId":"...","disposition":{"kind":"reuse","evidenceRefs":["..."]}}<</orchestrator>>
<<orchestrator>>{"action":"need","reason":"...","obligationId":"...","disposition":{"kind":"attach"}}<</orchestrator>>
<<orchestrator>>{"action":"need","reason":"...","obligationId":"...","disposition":{"kind":"refine"}}<</orchestrator>>
<<orchestrator>>{"action":"need","reason":"...","obligationId":"...","disposition":{"kind":"refuse"}}<</orchestrator>>

Judge only what needs judgement. The runtime already checks the request identity, what each role is allowed to ask for, whether the evidence references resolve, whether the inventory revision is current, that one obligation has one owner, and the remaining allowances. Never restate those checks as your reason and never grant to get around one. What is yours: whether existing evidence answers the question, whether two differently worded requests concern the same work, whether the residual gap justifies discovery, and whether a defect needs a local repair or a replan.

A repair goes to an implementer and a production test failure goes to an implementer too. A reviewer that found the defect never fixes it, and a tester never fixes production code. Do not make an implementer delegate what it can already fix inside its own scope: a delegation costs a dispatch and a fresh context, so grant one only when the requester genuinely cannot do the work itself.

A replan grant freezes the plan in flight: nothing queued starts and nothing publishes. The planner emits one revision that says what happens to every node, and the runtime adopts it as a whole or refuses it as a whole and leaves the old graph frozen. Grant one only for a defect that changes the shape of the work, and say in reason what the revision has to settle.

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
  isModelMetadataEnabled,
  spendLimitUsd,
  spentUsd,
  pendingRequest,
  evidenceExcerpts,
  unresolvedObligations,
  graphRevision,
  allowances,
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
  lines.push(
    '',
    'Available models, provider and model id and the efforts that model accepts. Automatic steps can use your connected providers:',
  );
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
  if (graphRevision != null && graphRevision.length > 0) {
    lines.push('', `Active graph revision: ${graphRevision}`);
  }
  if (allowances != null) {
    lines.push(
      '',
      'Remaining allowances (a grant that does not fit them is refused by the runtime, not by you):',
      `generated agents left: ${allowances.generationRemaining}`,
      `repair attempts left on this obligation: ${allowances.repairAttemptsRemaining}`,
      `structural replans left in this run: ${allowances.structuralReplansRemaining}`,
      allowances.spendRemainingUsd == null
        ? 'spend left: unlimited'
        : `spend left: $${allowances.spendRemainingUsd.toFixed(2)}`,
    );
  }
  if (unresolvedObligations != null && unresolvedObligations.length > 0) {
    lines.push('', 'Unresolved obligations and their current owners:');
    unresolvedObligations.forEach((obligation) => {
      lines.push(
        `${obligation.obligationId} - ${obligation.targetRole} for ${obligation.purpose} - state ${obligation.state} - owner ${obligation.ownerName ?? 'none'} - identity ${obligation.identity}`,
      );
    });
  }
  if (pendingRequest != null) {
    lines.push(
      '',
      'Pending capability need, exactly as the runtime validated it. Decide on this one:',
      `obligationId: ${pendingRequest.obligationId}`,
      `requester: ${pendingRequest.requesterName} (${pendingRequest.requesterRole})`,
      `requested: ${pendingRequest.targetRole} for ${pendingRequest.purpose}`,
      `question: ${pendingRequest.question}`,
      `gap: ${pendingRequest.gap.length > 0 ? pendingRequest.gap : '(none stated)'}`,
      `scope: ${pendingRequest.scope.length > 0 ? pendingRequest.scope.join(', ') : '(none stated)'}`,
      `expected result: ${pendingRequest.expectedOutput.length > 0 ? pendingRequest.expectedOutput : '(none stated)'}`,
      `requested continuation: ${pendingRequest.continuation}`,
      `evidence referenced: ${pendingRequest.evidenceRefs.length > 0 ? pendingRequest.evidenceRefs.join(', ') : '(none)'}`,
      `inventory revision: ${pendingRequest.inventoryRevision}`,
    );
  }
  if (evidenceExcerpts != null && evidenceExcerpts.length > 0) {
    lines.push('', 'Evidence behind that request, in full and never previewed:');
    evidenceExcerpts.forEach((entry) => {
      lines.push(
        `${entry.sourceId} [${entry.kind}, ${entry.availability}, revision ${entry.revision}] ${entry.label}`,
        entry.detail == null || entry.detail.length === 0 ? '(no content)' : entry.detail,
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
  lines.push(
    '',
    pendingRequest == null
      ? 'Return the marked decision now.'
      : 'Return the marked need decision now.',
  );
  return lines.join('\n');
};
