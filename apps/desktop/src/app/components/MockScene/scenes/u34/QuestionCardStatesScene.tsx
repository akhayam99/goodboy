import { QuestionCardCase } from './QuestionCardCase';
import { QUESTION_CARD_CASES } from './questionCardStatesSeed';

export const QuestionCardStatesScene = () => (
  <div
    data-shot
    data-qc-states=""
    className="flex w-full min-w-0 max-w-[680px] flex-col gap-10 bg-background p-4 text-foreground"
  >
    {QUESTION_CARD_CASES.map((entry) => (
      <QuestionCardCase key={entry.name} entry={entry} />
    ))}
  </div>
);
