import { splitLead } from '../reports/components/ArtifactPrintView/splitLead';

export type PlanBody = Readonly<{
  lead: string;
  rest: string;
}>;

const GOAL_HEADING_RE = /^#{1,3}\s+goal\s*$/i;
const HEADING_RE = /^#{1,6}\s/;

export const splitPlanBody = ({ bodyMd }: { readonly bodyMd: string }): PlanBody => {
  const lines = bodyMd.split('\n');
  const first = lines.findIndex((line) => line.trim().length > 0);
  if (first === -1 || !GOAL_HEADING_RE.test((lines[first] ?? '').trim())) {
    return splitLead({ sourceText: bodyMd });
  }
  const after = lines.slice(first + 1);
  const next = after.findIndex((line) => HEADING_RE.test(line));
  const goal = next === -1 ? after : after.slice(0, next);
  const rest = next === -1 ? [] : after.slice(next);
  return { lead: goal.join('\n').trim(), rest: rest.join('\n') };
};
