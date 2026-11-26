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
  readonly hasView: boolean;
  readonly hasSite: boolean;
  readonly isPinShown: boolean;
  readonly canOpenOutside: boolean;
};

export const browserMoreOffOf = ({
  hasAddress,
  hasTab,
  hasView,
  hasSite,
  isPinShown,
  canOpenOutside,
}: Params): BrowserMoreOff => ({
  isOpenOutsideOff: !canOpenOutside,
  isCopyAddressOff: !hasAddress,
  isDuplicateOff: !hasAddress,
  isReloadFromOriginOff: !hasTab,
  isClearSiteDataOff: !hasView || !hasSite,
  isInspectOff: !hasTab,
  isWidthOff: !hasTab,
  isCloseTabOff: !hasTab || isPinShown,
});
