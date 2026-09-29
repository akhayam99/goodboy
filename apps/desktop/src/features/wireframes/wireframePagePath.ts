import { WIREFRAME_SCREENS_DIR, wireframeScreenFile } from './wireframePages/wireframeScreenFile';

export const WIREFRAME_INDEX_PAGE = 'index.html';

const WIREFRAME_STATE_SEPARATOR = '--';

export type WireframePage = Readonly<{
  screenId: string;
  state: string | null;
}>;

export const screenPagePath = ({ screenId, state = null }: WireframePage): string =>
  `${WIREFRAME_SCREENS_DIR}/${wireframeScreenFile({
    screenId: state === null ? screenId : `${screenId}${WIREFRAME_STATE_SEPARATOR}${state}`,
  })}`;

export const pageOfPath = ({ path }: { readonly path: string }): WireframePage | null => {
  const prefix = `${WIREFRAME_SCREENS_DIR}/`;
  if (!path.startsWith(prefix) || !path.endsWith('.html')) {
    return null;
  }
  const name = path.slice(prefix.length, -'.html'.length);
  if (name.length === 0 || name.includes('/')) {
    return null;
  }
  const split = name.indexOf(WIREFRAME_STATE_SEPARATOR);
  if (split === -1) {
    return { screenId: name, state: null };
  }
  return {
    screenId: name.slice(0, split),
    state: name.slice(split + WIREFRAME_STATE_SEPARATOR.length),
  };
};
