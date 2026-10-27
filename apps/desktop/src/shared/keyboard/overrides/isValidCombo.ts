const VALID_COMBO =
  /^((cmd|ctrl|alt|shift)\+)*(Key[A-Z]|Digit[0-9]|F[0-9]{1,2}|Comma|Period|Slash|Minus|Equal|Backquote|BracketLeft|BracketRight|Backspace|Delete|Escape|Enter|Tab|Arrow(Up|Down|Left|Right))$/;

type Params = {
  readonly combo: string;
};

export const isValidCombo = ({ combo }: Params): boolean => VALID_COMBO.test(combo);
