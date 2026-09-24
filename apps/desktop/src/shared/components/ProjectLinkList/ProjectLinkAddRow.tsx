import { FolderPlus, Plus } from 'lucide-react';
import { Button, Input } from '@goodboy/ui';
import { ICON_SIZE } from '../conceptIcons';

type Props = {
  readonly path: string;
  readonly busy: boolean;
  readonly onPathChange: (path: string) => void;
  readonly onAdd: (params: { readonly rootPath: string }) => void;
  readonly onBrowse: () => void;
  readonly onNewProject: () => void;
};

export const ProjectLinkAddRow = ({
  path,
  busy,
  onPathChange,
  onAdd,
  onBrowse,
  onNewProject,
}: Props) => {
  const trimmed = path.trim();
  return (
    <div className="flex items-center gap-2">
      <Input
        type="text"
        value={path}
        aria-label="Project path"
        placeholder="/path/to/repository"
        disabled={busy}
        onChange={(event) => onPathChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || trimmed.length === 0) {
            return;
          }
          event.preventDefault();
          onAdd({ rootPath: trimmed });
        }}
        className="flex-1"
      />
      <Button variant="secondary" size="sm" onClick={onBrowse} disabled={busy}>
        Browse
      </Button>
      <Button
        variant="primary"
        size="sm"
        onClick={() => onAdd({ rootPath: trimmed })}
        disabled={busy || trimmed.length === 0}
      >
        <Plus size={ICON_SIZE.row} aria-hidden /> Add
      </Button>
      <Button variant="secondary" size="sm" onClick={onNewProject} disabled={busy}>
        <FolderPlus size={ICON_SIZE.row} aria-hidden /> New project
      </Button>
    </div>
  );
};
