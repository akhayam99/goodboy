import { KbdPill } from '@goodboy/ui';
import type { AnswerInputMode } from './answerInputMode';

type Props = {
  readonly inputMode: AnswerInputMode;
  readonly optionCount: number;
};

export const KeyHint = ({ inputMode, optionCount }: Props) => {
  if (inputMode === 'text') {
    return (
      <>
        <KbdPill>Enter</KbdPill>
        <span>to answer</span>
        <span aria-hidden>·</span>
        <KbdPill>Shift Enter</KbdPill>
        <span>for a new line</span>
      </>
    );
  }
  return (
    <>
      <KbdPill>{optionCount > 1 ? `1-${optionCount}` : '1'}</KbdPill>
      <span>{inputMode === 'many' ? 'to toggle' : 'to pick'}</span>
      <span aria-hidden>·</span>
      <KbdPill>Enter</KbdPill>
      <span>to answer</span>
    </>
  );
};
