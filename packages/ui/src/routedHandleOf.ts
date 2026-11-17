import type { MutableRefObject } from 'react';
import type { ResizableHandleProps } from './useResizableWidth';

type Preview = (width: number) => void;

type Params = {
  readonly handle: ResizableHandleProps;
  readonly route: MutableRefObject<Preview>;
  readonly preview: Preview;
};

type CallParams = {
  readonly call: Preview;
};

export const routedHandleOf = ({ handle, route, preview }: Params): ResizableHandleProps => {
  const routeThen =
    ({ call }: CallParams): Preview =>
    (width) => {
      route.current = preview;
      call(width);
    };
  return {
    ...handle,
    onChange: routeThen({ call: handle.onChange }),
    onCommit: routeThen({ call: handle.onCommit }),
    onReset: () => {
      route.current = preview;
      handle.onReset();
    },
  };
};
