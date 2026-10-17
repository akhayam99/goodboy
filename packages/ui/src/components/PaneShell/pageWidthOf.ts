import { PAGE_MEASURE, type FramePage } from '../../frameGeometry';
import type { PageColumnWidth } from '../PageColumn';

type Params = {
  readonly page: FramePage | undefined;
  readonly width: PageColumnWidth | undefined;
};

export const pageWidthOf = ({ page, width }: Params): PageColumnWidth => {
  if (width !== undefined) {
    return width;
  }
  return page === undefined ? 'column' : PAGE_MEASURE[page];
};
