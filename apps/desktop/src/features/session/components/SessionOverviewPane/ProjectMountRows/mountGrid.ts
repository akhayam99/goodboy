export const MOUNT_ROW_HEIGHT = 36;

export const MOUNT_ROW_PAD = 4;

const MOUNT_CHILD_INDENT = 22;

export const MOUNT_CHILD_PAD = MOUNT_ROW_PAD + MOUNT_CHILD_INDENT;

export const MOUNT_TOGGLE_PAD = MOUNT_CHILD_PAD - 8;

const BRANCH_TRACK = 'minmax(0,1fr)';
const REQUEST_TRACK_PX = 96;
const CHANGES_TRACK_PX = 96;
const ACTION_TRACK_PX = 200;

export const mountGridTracksOf = (): ReadonlyArray<string> => [
  BRANCH_TRACK,
  `${REQUEST_TRACK_PX}px`,
  `${CHANGES_TRACK_PX}px`,
  `${ACTION_TRACK_PX}px`,
];
