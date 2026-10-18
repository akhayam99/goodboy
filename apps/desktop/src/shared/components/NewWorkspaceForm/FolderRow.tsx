import { X } from 'lucide-react';
import { Checkbox, IconButton } from '@goodboy/ui';
import type { FolderEntry } from './folderEntry';
import type { FolderRowContext } from './folderRowContext';
import { PlainFolderRow } from './PlainFolderRow';
import { RepositoryRow } from './RepositoryRow';
import { UnreadableFolderRow } from './UnreadableFolderRow';
import type { WorkspaceDraft } from './useWorkspaceDraft';

type Props = {
  readonly folder: FolderEntry;
  readonly draft: WorkspaceDraft;
  readonly home: string | null;
  readonly destinationName: string;
  readonly isMulti: boolean;
  readonly isBusy: boolean;
};

export const FolderRow = ({ folder, draft, home, destinationName, isMulti, isBusy }: Props) => {
  const lead = isMulti ? (
    <Checkbox
      checked={folder.isIncluded}
      disabled={isBusy}
      ariaLabel={`Include ${folder.name}`}
      onChange={() => draft.toggle({ path: folder.path })}
    />
  ) : null;
  const trailing = isMulti ? null : (
    <IconButton
      icon={X}
      label={`Remove ${folder.name}`}
      size="xs"
      variant="ghost"
      disabled={isBusy}
      className="text-faint-foreground"
      onClick={() => draft.remove({ path: folder.path })}
    />
  );
  const context: FolderRowContext = { draft, home, destinationName, isBusy, lead, trailing };
  switch (folder.kind) {
    case 'repository':
      return <RepositoryRow folder={folder} {...context} />;
    case 'plain':
      return <PlainFolderRow folder={folder} {...context} />;
    case 'unreadable':
      return <UnreadableFolderRow folder={folder} {...context} />;
    default: {
      const unreachable: never = folder;
      return unreachable;
    }
  }
};
