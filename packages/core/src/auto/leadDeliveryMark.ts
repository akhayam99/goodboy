export const LEAD_DELIVERY_MARK = {
  wholeList: '(THE WHOLE LIST NOW: an entry you were told before and not listed here is gone.)',
  cleared: '(NOW EMPTY: what you were told under it no longer holds.)',
} as const satisfies Readonly<Record<'wholeList' | 'cleared', string>>;
