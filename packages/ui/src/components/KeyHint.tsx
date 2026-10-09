import { Kbd, isChordHint } from './Kbd';

export type KeyHintProps = {
  readonly keys: string;
  readonly isOnTone?: boolean;
};

export const KeyHint = ({ keys, isOnTone = false }: KeyHintProps) => (
  <Kbd aria-hidden look={isChordHint(keys) ? 'inline' : 'cap'} isOnTone={isOnTone}>
    {keys}
  </Kbd>
);
