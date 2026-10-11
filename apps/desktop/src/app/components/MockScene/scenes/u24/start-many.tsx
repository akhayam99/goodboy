import { StartManyScene } from './start-many/StartManyScene';

export const U24_START_MANY_SCENES = {
  'start-multiselect': () => <StartManyScene mode="multiselect" />,
  'start-cap': () => <StartManyScene mode="cap" />,
  'start-picked3': () => <StartManyScene mode="picked3" />,
  'start-crossproject': () => <StartManyScene mode="crossproject" />,
};
