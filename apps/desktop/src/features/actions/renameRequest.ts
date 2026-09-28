export const RENAME_REQUEST_EVENT = 'goodboy:rename-object';

export type RenameRequest = {
  readonly objectKey: string;
  readonly anchorKey: string | null;
};

type Params = RenameRequest;

export const requestRename = ({ objectKey, anchorKey }: Params): boolean => {
  const event = new CustomEvent<RenameRequest>(RENAME_REQUEST_EVENT, {
    detail: { objectKey, anchorKey },
    cancelable: true,
  });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};
