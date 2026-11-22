import { SHELL_GUTTER_PX } from './frameGeometry';
import { STUDIO_RAIL_FOLD_BELOW } from './useStudioRailFold';

const DESK_COLUMN_PX = 300;

type Params = {
  readonly bodyWidth: number;
};

export const isDeskColumnFolded = ({ bodyWidth }: Params): boolean =>
  bodyWidth - DESK_COLUMN_PX - SHELL_GUTTER_PX < STUDIO_RAIL_FOLD_BELOW;
