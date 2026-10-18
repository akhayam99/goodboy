import { useEffect, useRef } from 'react';
import { SELECT_REQUEST_EVENT, type SelectRequest } from '../selectRequest';

type Params = {
  readonly objectKey: string;
  readonly anchorKey: string;
  readonly onSelect: () => void;
};

const isSelectRequest = (event: Event): event is CustomEvent<SelectRequest> =>
  event instanceof CustomEvent &&
  typeof event.detail === 'object' &&
  event.detail !== null &&
  'objectKey' in event.detail;

export const useSelectRequest = ({ objectKey, anchorKey, onSelect }: Params): void => {
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const onRequest = (event: Event) => {
      if (!isSelectRequest(event) || event.defaultPrevented) {
        return;
      }
      if (event.detail.objectKey !== objectKey || event.detail.anchorKey !== anchorKey) {
        return;
      }
      event.preventDefault();
      onSelectRef.current();
    };
    window.addEventListener(SELECT_REQUEST_EVENT, onRequest);
    return () => window.removeEventListener(SELECT_REQUEST_EVENT, onRequest);
  }, [anchorKey, objectKey]);
};
