export const MOUNT_ROW_HEIGHT = 36;

const BRANCH_TRACK = 'minmax(0,1fr)';
const REQUEST_TRACK_PX = 96;
const CHANGES_TRACK_PX = 120;
const ACTION_TRACK_PX = 176;

export const mountGridTracksOf = (): ReadonlyArray<string> => [
  BRANCH_TRACK,
  `${REQUEST_TRACK_PX}px`,
  `${CHANGES_TRACK_PX}px`,
  `${ACTION_TRACK_PX}px`,
];
