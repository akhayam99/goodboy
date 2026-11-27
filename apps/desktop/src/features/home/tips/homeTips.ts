import { NAMES } from '../../../shared/utils/names';

export type HomeTip = {
  readonly id: string;
  readonly text: string;
};

export type TipDismiss = {
  readonly tipId: string;
};

export const HOME_TIPS: ReadonlyArray<HomeTip> = [
  {
    id: 'hide',
    text: 'Hide a card with the eye in its corner. It waits under Hidden, and Undo brings it back.',
  },
  {
    id: 'ask',
    text: `${NAMES.askAgent} works without a session. Press ${NAMES.askAgent} on the right rail to question the workspace.`,
  },
];
