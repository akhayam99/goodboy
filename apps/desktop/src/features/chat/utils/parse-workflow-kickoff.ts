const GOAL_LABEL = '**Goal**';
const PLAN_LABEL = '**Plan**';
const MARKER_ANCHOR = '**Scope** this step only';

export type ParsedWorkflowKickoff = {
  goal: string;
  instructions: string;
  marker: string;
  parsed: boolean;
};

export const isWorkflowKickoff = (text: string): boolean =>
  text.startsWith(GOAL_LABEL) && text.includes(MARKER_ANCHOR);

export const parseWorkflowKickoff = (text: string): ParsedWorkflowKickoff => {
  const fail: ParsedWorkflowKickoff = { goal: '', instructions: '', marker: '', parsed: false };
  if (!isWorkflowKickoff(text)) {
    return fail;
  }

  const markerIndex = text.indexOf(MARKER_ANCHOR);
  if (markerIndex < 0) {
    return fail;
  }
  const marker = text.slice(markerIndex).trim();
  const body = text.slice(GOAL_LABEL.length, markerIndex).replace(/^\s+/, '');

  const planIndex = body.indexOf(PLAN_LABEL);
  let goal: string;
  let instructions: string;
  if (planIndex >= 0) {
    goal = body.slice(0, planIndex).trim();
    instructions = body.slice(planIndex).trim();
  } else {
    const paragraphBreak = body.indexOf('\n\n');
    if (paragraphBreak >= 0) {
      goal = body.slice(0, paragraphBreak).trim();
      instructions = body.slice(paragraphBreak).trim();
    } else {
      goal = body.trim();
      instructions = '';
    }
  }

  if (goal.length === 0) {
    return { goal: '', instructions: '', marker, parsed: false };
  }
  return { goal, instructions, marker, parsed: true };
};
