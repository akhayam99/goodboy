export type BrowserMoreOff = {
  readonly isOpenOutsideOff: boolean;
  readonly isCopyAddressOff: boolean;
  readonly isDuplicateOff: boolean;
  readonly isReloadFromOriginOff: boolean;
  readonly isClearSiteDataOff: boolean;
  readonly isInspectOff: boolean;
  readonly isWidthOff: boolean;
  readonly isCloseTabOff: boolean;
};

type Params = {
  readonly hasAddress: boolean;
  readonly hasTab: boolean;
  readonly hasLivePage: boolean;
  readonly hasSite: boolean;
  readonly isPinShown: boolean;
  readonly canOpenOutside: boolean;
};

export const browserMoreOffOf = ({
  hasAddress,
  hasTab,
  hasLivePage,
  hasSite,
  isPinShown,
  canOpenOutside,
}: Params): BrowserMoreOff => ({
  isOpenOutsideOff: !canOpenOutside,
  isCopyAddressOff: !hasAddress,
  isDuplicateOff: !hasAddress,
  isReloadFromOriginOff: !hasTab,
  isClearSiteDataOff: !hasLivePage || !hasSite,
  isInspectOff: !hasTab,
  isWidthOff: !hasTab,
  isCloseTabOff: !hasTab || isPinShown,
});
