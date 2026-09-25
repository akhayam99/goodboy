import type { WireframeFolderExportStatus } from './index';

export type FolderExportNote = Readonly<{ text: string; isError: boolean }>;

export const folderExportNote = ({
  status,
}: {
  readonly status: WireframeFolderExportStatus;
}): FolderExportNote | null => {
  switch (status.kind) {
    case 'saved':
      return { text: `Exported to ${status.path}`, isError: false };
    case 'cancelled':
      return { text: 'Export cancelled', isError: false };
    case 'failed':
      return { text: status.message, isError: true };
    case 'idle':
    case 'busy':
      return null;
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
};
