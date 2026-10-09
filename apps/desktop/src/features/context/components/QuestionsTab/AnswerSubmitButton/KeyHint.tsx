import { Kbd } from '@goodboy/ui';
import type { AnswerInputMode } from './answerInputMode';

type Props = {
  readonly inputMode: AnswerInputMode;
  readonly optionCount: number;
};

export const KeyHint = ({ inputMode, optionCount }: Props) => {
  if (inputMode === 'text') {
    return (
      <>
        <Kbd look="cap">Enter</Kbd>
        <span>to answer</span>
        <span aria-hidden>·</span>
        <Kbd look="inline">Shift Enter</Kbd>
        <span>for a new line</span>
      </>
    );
  }
  return (
    <>
      <Kbd look="cap">{optionCount > 1 ? `1-${optionCount}` : '1'}</Kbd>
      <span>{inputMode === 'many' ? 'to toggle' : 'to pick'}</span>
      <span aria-hidden>·</span>
      <Kbd look="cap">Enter</Kbd>
      <span>to answer</span>
    </>
  );
};
