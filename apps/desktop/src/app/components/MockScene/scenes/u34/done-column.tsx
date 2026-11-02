import { DoneColumnScene } from './DoneColumnScene';

export const U34_DONE_COLUMN_SCENES = {
  'u34-u19-column-done-closed': () => <DoneColumnScene isDoneOpen={false} />,
  'u34-u19-column-done-open': () => <DoneColumnScene isDoneOpen />,
};
