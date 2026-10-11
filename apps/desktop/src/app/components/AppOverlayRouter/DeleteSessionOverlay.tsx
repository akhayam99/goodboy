import { useEffect, useState } from 'react';
import type { Session } from '@goodboy/types';
import { DeleteSessionConfirm } from '../../../features/session/components/DeleteSessionConfirm';

type Props = {
  readonly session: Session;
  readonly isOpen: boolean;
  readonly onClose: () => void;
};

export const DeleteSessionOverlay = ({ session, isOpen, onClose }: Props) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => setIsMounted(true), []);

  return (
    <DeleteSessionConfirm
      session={session}
      isOpen={isOpen && isMounted}
      onClose={onClose}
      trigger={() => <span aria-hidden className="fixed bottom-4 right-4 size-0" />}
    />
  );
};
