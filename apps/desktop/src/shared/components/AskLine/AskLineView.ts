export type AskLinePhase = 'thinking' | 'streaming' | 'answered' | 'failed';

export type AskLineAnswerView = Readonly<{
  question: string;
  phase: AskLinePhase;
  text: string;
  sources: ReadonlyArray<string>;
  origin: string;
  note: string;
  error: string | null;
}>;

export type AskLineQuestionParams = Readonly<{
  question: string;
}>;

export type AskLineSendParams = Readonly<{
  text: string;
}>;

export type AskLineMessageView = Readonly<{
  label: string;
  recipient: string;
  onSend: (params: AskLineSendParams) => Promise<boolean>;
}>;
