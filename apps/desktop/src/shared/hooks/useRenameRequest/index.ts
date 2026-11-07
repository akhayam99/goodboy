import { useEffect, useRef } from 'react';
import { RENAME_REQUEST_EVENT, type RenameRequest } from '../../utils/renameRequest';

type Params = {
  readonly objectKey: string;
  readonly anchorKeys: ReadonlyArray<string | null>;
  readonly onRename: () => void;
};

type DetailParams = {
  readonly event: Event;
};

const renameDetailOf = ({ event }: DetailParams): RenameRequest | null => {
  if (!(event instanceof CustomEvent) || event.defaultPrevented) {
    return null;
  }
  const detail: unknown = event.detail;
  if (typeof detail !== 'object' || detail === null) {
    return null;
  }
  if (!('objectKey' in detail) || !('anchorKey' in detail)) {
    return null;
  }
  const { objectKey, anchorKey } = detail;
  return typeof objectKey === 'string' && (typeof anchorKey === 'string' || anchorKey === null)
    ? { objectKey, anchorKey }
    : null;
};

export const useRenameRequest = ({ objectKey, anchorKeys, onRename }: Params): void => {
  const onRenameRef = useRef(onRename);
  onRenameRef.current = onRename;
  const anchorsRef = useRef(anchorKeys);
  anchorsRef.current = anchorKeys;

  useEffect(() => {
    const controller = new AbortController();
    window.addEventListener(
      RENAME_REQUEST_EVENT,
      (event) => {
        const detail = renameDetailOf({ event });
        if (detail === null || detail.objectKey !== objectKey) {
          return;
        }
        if (!anchorsRef.current.includes(detail.anchorKey)) {
          return;
        }
        event.preventDefault();
        onRenameRef.current();
      },
      { signal: controller.signal },
    );
    return () => controller.abort();
  }, [objectKey]);
};
