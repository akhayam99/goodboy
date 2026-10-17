import type { ReactNode } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { Button, FormActions } from '@goodboy/ui';
import { useDraftDiscard } from './useDraftDiscard';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly leading?: ReactNode;
  readonly note: string | null;
  readonly error?: string | null;
  readonly isStarting: boolean;
  readonly children: ReactNode;
};

export const StartFooter = ({
  workspaceId,
  leading = null,
  note,
  error = null,
  isStarting,
  children,
}: Props) => {
  const { canDiscard, discard } = useDraftDiscard({ workspaceId });
  return (
    <FormActions leading={leading} reason={note} error={error}>
      {canDiscard ? (
        <Button variant="ghost" size="sm" onClick={discard} disabled={isStarting}>
          Discard
        </Button>
      ) : null}
      {children}
    </FormActions>
  );
};
