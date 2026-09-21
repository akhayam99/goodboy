export type StagedAnswerEntry = {
  readonly text: string;
  readonly answer: string;
};

type Params = {
  readonly entries: ReadonlyArray<StagedAnswerEntry>;
};

const collapse = (value: string): string => value.trim().replace(/\s+/g, ' ');

export const summarizeStagedAnswers = ({ entries }: Params): string =>
  entries
    .filter((entry) => entry.answer.trim().length > 0)
    .map((entry) => `${collapse(entry.text)} → ${collapse(entry.answer)}`)
    .join(' · ');
