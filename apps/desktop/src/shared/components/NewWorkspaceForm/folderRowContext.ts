import type { ReactNode } from 'react';
import type { WorkspaceDraft } from './useWorkspaceDraft';

export type FolderRowContext = {
  readonly draft: WorkspaceDraft;
  readonly home: string | null;
  readonly destinationName: string;
  readonly isBusy: boolean;
  readonly lead: ReactNode;
  readonly trailing: ReactNode;
};
