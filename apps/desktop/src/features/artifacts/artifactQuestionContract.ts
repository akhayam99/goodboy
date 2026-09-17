import type { GeneratedArtifactKind } from './artifactCollection';

export const ARTIFACT_QUESTION_LIMIT = 2;

const ASSUMPTION_HOME: Readonly<Record<GeneratedArtifactKind, string>> = {
  report: 'a line in the body of the report',
  wireframe: 'a node note on the screen it decides',
};

const SUBJECT: Readonly<Record<GeneratedArtifactKind, string>> = {
  report: 'report',
  wireframe: 'wireframe',
};

type Params = Readonly<{
  kind: GeneratedArtifactKind;
}>;

export const artifactQuestionContract = ({ kind }: Params): string =>
  [
    '## questions',
    `ask only when this pack has a real gap that changes the ${SUBJECT[kind]}: a path the goal named that no scout found, two repositories that answer the same thing differently, a screen with no route behind it. never ask about a preference the brief already answers, and never ask for permission to carry on.`,
    `at most ${ARTIFACT_QUESTION_LIMIT} questions, each one alone on its own line, in exactly this shape:`,
    '<<ctx-question suggestions="first option|second option" recommended="first option" select="one">>the question<</ctx-question>>',
    'suggestions, recommended and select are all required. suggestions holds 2 to 4 options separated by a pipe, recommended repeats one of them word for word, and select is "one" when a single option can hold, "many" when several can.',
    `put the questions before the artifact block, in the same turn. then produce the ${SUBJECT[kind]} anyway: answer every question yourself with your own recommended value, and write that assumption into ${ASSUMPTION_HOME[kind]} so the reader sees what was decided for them. never wait for an answer, never stop at the questions, and never send a turn that carries questions and no artifact.`,
  ].join('\n\n');
