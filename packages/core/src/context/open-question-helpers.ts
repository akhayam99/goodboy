const OQ_ANSWER_OPEN = '<<oq-answers>>';
const OQ_ANSWER_CLOSE = '<</oq-answers>>';

export const wrapOpenQuestionAnswers = (body: string): string =>
  `${OQ_ANSWER_OPEN}\n${body}\n${OQ_ANSWER_CLOSE}`;

export const isOpenQuestionAnswerText = (text: string): boolean =>
  text.trimStart().startsWith(OQ_ANSWER_OPEN);
