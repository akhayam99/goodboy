type SurfaceParams = {
  readonly surface: string;
};

type WidthParams = SurfaceParams & {
  readonly width: number | null;
};

type NarrowParams = SurfaceParams & {
  readonly isNarrow: boolean;
};

type ListenerParams = {
  readonly listener: () => void;
};

const widths = new Map<string, number>();
const narrows = new Set<string>();
const listeners = new Set<() => void>();

const notifyPaneListeners = (): void => {
  for (const listener of listeners) {
    listener();
  }
};

export const studioRailPaneStore = {
  width: ({ surface }: SurfaceParams): number | null => widths.get(surface) ?? null,
  isNarrow: ({ surface }: SurfaceParams): boolean => narrows.has(surface),
  setWidth: ({ surface, width }: WidthParams): void => {
    if ((widths.get(surface) ?? null) === width) {
      return;
    }
    if (width === null) {
      widths.delete(surface);
      notifyPaneListeners();
      return;
    }
    widths.set(surface, width);
    notifyPaneListeners();
  },
  setNarrow: ({ surface, isNarrow }: NarrowParams): void => {
    if (narrows.has(surface) === isNarrow) {
      return;
    }
    if (isNarrow) {
      narrows.add(surface);
      notifyPaneListeners();
      return;
    }
    narrows.delete(surface);
    notifyPaneListeners();
  },
  subscribe: ({ listener }: ListenerParams): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
