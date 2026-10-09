import { Kbd, isChordHint } from './Kbd';

export type KeyHintProps = {
  readonly keys: string;
  readonly onTone?: boolean;
};

export const KeyHint = ({ keys, onTone = false }: KeyHintProps) => (
  <Kbd aria-hidden look={isChordHint(keys) ? 'inline' : 'cap'} onTone={onTone}>
    {keys}
  </Kbd>
);
