import type { WireframeDocument } from '@goodboy/core';
import { isWideContactSheet } from '../../../wireframes/contactSheetLayout';

export type PrintPage = 'landscape' | 'portrait';

type Params = {
  readonly document: WireframeDocument | null;
};

export const printPage = ({ document }: Params): PrintPage => {
  if (document === null) {
    return 'portrait';
  }
  return isWideContactSheet({ screens: document.screens }) ? 'landscape' : 'portrait';
};
