export const SELECT_REQUEST_EVENT = 'goodboy:select-object';

export type SelectRequest = {
  readonly objectKey: string;
  readonly anchorKey: string | null;
};

type Params = SelectRequest;

export const requestSelect = ({ objectKey, anchorKey }: Params): boolean => {
  const event = new CustomEvent<SelectRequest>(SELECT_REQUEST_EVENT, {
    detail: { objectKey, anchorKey },
    cancelable: true,
  });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};
