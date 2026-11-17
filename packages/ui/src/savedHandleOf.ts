import type { DockGridSpec } from './dockGridSpec';
import type { ResizableHandleProps } from './useResizableWidth';

type Params = {
  readonly handle: ResizableHandleProps;
  readonly key: string | null;
  readonly baseWidth: number;
  readonly onResize: DockGridSpec['onResize'];
};

type SaverParams = {
  readonly handle: ResizableHandleProps;
  readonly key: string;
  readonly onResize: NonNullable<DockGridSpec['onResize']>;
};

const saverOf =
  ({ handle, key, onResize }: SaverParams): ResizableHandleProps['onCommit'] =>
  (width) => {
    const clamped = Math.round(Math.min(handle.max, Math.max(handle.min, width)));
    handle.onChange(clamped);
    onResize({ key, width: clamped });
  };

export const savedHandleOf = ({
  handle,
  key,
  baseWidth,
  onResize,
}: Params): ResizableHandleProps => {
  if (onResize === undefined || key === null) {
    return handle;
  }
  const save = saverOf({ handle, key, onResize });
  return { ...handle, onCommit: save, onReset: () => save(baseWidth) };
};
