export type SheetEdge = 'wrapped' | 'flush';

export type ResizeActivity = 'idle' | 'hover' | 'drag';

export const SHEET_CLASSES: Readonly<Record<SheetEdge, string>> = {
  wrapped:
    'rounded-l-frame border border-r-0 border-frame-edge motion-safe:transition-colors motion-safe:duration-120 motion-safe:ease-default data-[left-resize=hover]:border-l-border data-[left-resize=drag]:border-l-border',
  flush: 'border-y border-frame-edge',
};
