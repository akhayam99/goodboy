export type BrowserMoreOff = {
  readonly isOpenOutsideOff: boolean;
  readonly isCopyAddressOff: boolean;
  readonly isDuplicateOff: boolean;
  readonly isInspectOff: boolean;
  readonly isCloseTabOff: boolean;
};

type Params = {
  readonly hasAddress: boolean;
  readonly hasTab: boolean;
  readonly isPinShown: boolean;
  readonly canOpenOutside: boolean;
};

export const browserMoreOffOf = ({
  hasAddress,
  hasTab,
  isPinShown,
  canOpenOutside,
}: Params): BrowserMoreOff => ({
  isOpenOutsideOff: !canOpenOutside,
  isCopyAddressOff: !hasAddress,
  isDuplicateOff: !hasAddress,
  isInspectOff: !hasTab,
  isCloseTabOff: !hasTab || isPinShown,
});
