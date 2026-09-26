export const CONTEXT_ORDER = ['Goal', 'Decisions', 'Summary', 'Open questions'] as const;

type Params = {
  readonly goal: string;
  readonly decisions: string;
  readonly summary: string;
  readonly openQuestions: ReadonlyArray<string>;
};

export const shareableContext = ({ goal, decisions, summary, openQuestions }: Params): string => {
  const questions = openQuestions.map((question) => `- ${question}`).join('\n');
  const bodies: ReadonlyArray<string> = [goal.trim(), decisions.trim(), summary.trim(), questions];
  return CONTEXT_ORDER.flatMap((title, index) => {
    const body = bodies[index] ?? '';
    return body === '' ? [] : [`## ${title}\n\n${body}`];
  }).join('\n\n');
};
