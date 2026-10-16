import type { ReactNode } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { Button, FormActions } from '@goodboy/ui';
import { useDraftDiscard } from './useDraftDiscard';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly note: string | null;
  readonly error?: string | null;
  readonly isStarting: boolean;
  readonly children: ReactNode;
};

export const StartFooter = ({ workspaceId, note, error = null, isStarting, children }: Props) => {
  const { canDiscard, discard } = useDraftDiscard({ workspaceId });
  return (
    <FormActions
      leading={
        note === null ? null : (
          <span className="min-w-0 text-meta text-faint-foreground">{note}</span>
        )
      }
      error={error}
    >
      {canDiscard ? (
        <Button variant="ghost" size="sm" onClick={discard} disabled={isStarting}>
          Discard
        </Button>
      ) : null}
      {children}
    </FormActions>
  );
};
