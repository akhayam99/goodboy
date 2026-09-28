import { useEffect, useRef } from 'react';
import { RENAME_REQUEST_EVENT, type RenameRequest } from '../renameRequest';

type Params = {
  readonly objectKey: string;
  readonly anchorKeys: ReadonlyArray<string | null>;
  readonly onRename: () => void;
};

const isRenameRequest = (event: Event): event is CustomEvent<RenameRequest> =>
  event instanceof CustomEvent &&
  typeof event.detail === 'object' &&
  event.detail !== null &&
  'objectKey' in event.detail;

export const useRenameRequest = ({ objectKey, anchorKeys, onRename }: Params): void => {
  const onRenameRef = useRef(onRename);
  onRenameRef.current = onRename;
  const anchorsRef = useRef(anchorKeys);
  anchorsRef.current = anchorKeys;

  useEffect(() => {
    const onRequest = (event: Event) => {
      if (!isRenameRequest(event) || event.defaultPrevented) {
        return;
      }
      if (event.detail.objectKey !== objectKey) {
        return;
      }
      if (!anchorsRef.current.includes(event.detail.anchorKey)) {
        return;
      }
      event.preventDefault();
      onRenameRef.current();
    };
    window.addEventListener(RENAME_REQUEST_EVENT, onRequest);
    return () => window.removeEventListener(RENAME_REQUEST_EVENT, onRequest);
  }, [objectKey]);
};
