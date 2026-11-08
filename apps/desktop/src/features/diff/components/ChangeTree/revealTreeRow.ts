import type { RefObject } from 'react';
import { appScrollIntoView, appScrollTo } from '@goodboy/ui';
import type { TreeRow } from '../../lib/changeTree';
import { rowHeightOf } from '../../lib/rowHeightOf';
import { scrollTopToReveal, type RowLayout } from '../../../../shared/utils/windowRows';

type Params = {
  readonly viewportRef: RefObject<HTMLElement | null>;
  readonly isWindowed: boolean;
  readonly rows: ReadonlyArray<TreeRow>;
  readonly layout: RowLayout;
  readonly id: string;
  readonly domId: string;
};

export const revealTreeRow = ({
  viewportRef,
  isWindowed,
  rows,
  layout,
  id,
  domId,
}: Params): void => {
  const viewport = viewportRef.current;
  if (!isWindowed || viewport === null) {
    appScrollIntoView({ element: document.getElementById(domId), block: 'nearest' });
    return;
  }
  const index = rows.findIndex((row) => row.id === id);
  const row = rows[index];
  if (row === undefined) {
    return;
  }
  const next = scrollTopToReveal({
    layout,
    index,
    rowPx: rowHeightOf(row),
    scrollTop: viewport.scrollTop,
    viewport: viewport.clientHeight,
  });
  if (next !== viewport.scrollTop) {
    appScrollTo({ viewport, top: next });
  }
};
