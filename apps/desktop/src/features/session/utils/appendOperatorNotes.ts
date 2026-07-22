type Params = {
  readonly prompt: string;
  readonly hint: string;
};

export const appendOperatorNotes = ({ prompt, hint }: Params): string => {
  const notes = hint.trim();
  if (notes.length === 0) {
    return prompt;
  }
  return [prompt, '', 'Operator notes:', '---', notes, '---'].join('\n');
};
