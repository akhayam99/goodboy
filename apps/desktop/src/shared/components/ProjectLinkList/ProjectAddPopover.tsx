import { FolderPlus, Plus } from 'lucide-react';
import { AnchoredPopover, Button, Input, useDropdown } from '@goodboy/ui';
import { ICON_SIZE } from '../conceptIcons';

type Props = {
  readonly path: string;
  readonly busy: boolean;
  readonly onPathChange: (path: string) => void;
  readonly onAdd: (params: { readonly rootPath: string }) => void;
  readonly onBrowse: () => void;
  readonly onNewProject: () => void;
  readonly onLinkPlainFolder: () => void;
};

export const ProjectAddPopover = ({
  path,
  busy,
  onPathChange,
  onAdd,
  onBrowse,
  onNewProject,
  onLinkPlainFolder,
}: Props) => {
  const dropdown = useDropdown({ align: 'end', width: 'w-96', expectedHeight: 170 });
  const trimmed = path.trim();

  const add = () => {
    if (trimmed.length === 0) {
      return;
    }
    onAdd({ rootPath: trimmed });
    dropdown.close();
  };

  const runAndClose = (action: () => void) => {
    action();
    dropdown.close();
  };

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Add project"
      className="flex flex-col"
      trigger={
        <Button
          variant="ghost"
          size="sm"
          onClick={dropdown.toggle}
          aria-expanded={dropdown.open}
          disabled={busy}
        >
          <Plus size={ICON_SIZE.row} aria-hidden />
          Add project
        </Button>
      }
    >
      <div className="flex items-center gap-2 p-3">
        <Input
          type="text"
          value={path}
          aria-label="Project path"
          placeholder="/path/to/repository"
          disabled={busy}
          autoFocus
          onChange={(event) => onPathChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') {
              return;
            }
            event.preventDefault();
            add();
          }}
          className="flex-1 font-mono"
        />
        <Button variant="secondary" size="sm" onClick={onBrowse} disabled={busy}>
          Browse
        </Button>
      </div>
      <div className="flex items-center gap-2 px-3 pb-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => runAndClose(onLinkPlainFolder)}
          disabled={busy}
        >
          Link a plain folder
        </Button>
        <span className="flex-1" />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => runAndClose(onNewProject)}
          disabled={busy}
        >
          <FolderPlus size={ICON_SIZE.row} aria-hidden />
          New project
        </Button>
        <Button variant="primary" size="sm" onClick={add} disabled={busy || trimmed.length === 0}>
          Add
        </Button>
      </div>
    </AnchoredPopover>
  );
};
