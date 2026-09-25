import { useState, type ReactNode } from 'react';
import { Copy, ExternalLink, Folder, FolderGit2, Unplug } from 'lucide-react';
import type { Project } from '@goodboy/types';
import { InlineConfirm, OverflowMenu, Tooltip } from '@goodboy/ui';
import { openInEditor } from '../../lib/editor';
import { useAppStore } from '../../../store';
import { ICON_SIZE } from '../conceptIcons';
import { ProjectDescriptionField } from './ProjectDescriptionField';
import { ProjectStarToggle } from './ProjectStarToggle';

type Props = {
  readonly project: Project;
  readonly busy: boolean;
  readonly accessory: ReactNode;
  readonly onUnlink: (params: { readonly project: Project }) => Promise<void>;
};

export const ProjectLinkCompactRow = ({ project, busy, accessory, onUnlink }: Props) => {
  const reportError = useAppStore((state) => state.reportError);
  const [isConfirming, setConfirming] = useState(false);
  const isRepo = project.kind === 'repo';
  const KindIcon = isRepo ? FolderGit2 : Folder;

  const openProject = async () => {
    try {
      await openInEditor(project.rootPath);
    } catch (error) {
      void reportError({ title: `Couldn't open ${project.name}`, error });
    }
  };

  const copyPath = async () => {
    try {
      await navigator.clipboard.writeText(project.rootPath);
    } catch (error) {
      void reportError({ title: "Couldn't copy the path", error });
    }
  };

  return (
    <li className="flex flex-col gap-1">
      <div className="flex h-9 min-w-0 items-center gap-2 rounded-md px-2 hover:bg-hover">
        <ProjectStarToggle project={project} busy={busy} />
        <KindIcon
          size={ICON_SIZE.row}
          role="img"
          aria-label={isRepo ? 'Repository' : 'Folder'}
          className="shrink-0 text-muted-foreground"
        />
        <Tooltip content={project.rootPath} anchorClassName="flex min-w-0 max-w-[40%] shrink-0">
          <span tabIndex={0} className="truncate text-sm font-medium text-foreground">
            {project.name}
          </span>
        </Tooltip>
        <ProjectDescriptionField project={project} busy={busy} />
        {accessory}
        <OverflowMenu
          label={`Actions for ${project.name}`}
          disabled={busy}
          items={[
            {
              kind: 'item',
              key: 'open',
              label: 'Open in editor',
              icon: ExternalLink,
              onClick: () => void openProject(),
            },
            {
              kind: 'item',
              key: 'copy',
              label: 'Copy path',
              icon: Copy,
              onClick: () => void copyPath(),
            },
            { kind: 'separator', key: 'unlink-separator' },
            {
              kind: 'item',
              key: 'unlink',
              label: 'Unlink',
              icon: Unplug,
              destructive: true,
              onClick: () => setConfirming(true),
            },
          ]}
        />
      </div>
      {isConfirming ? (
        <InlineConfirm
          role="danger"
          icon={<Unplug size={ICON_SIZE.row} aria-hidden />}
          title={`Unlink ${project.name}?`}
          description="The folder stays on disk. Link it again any time."
          confirmLabel="Unlink"
          isBusy={busy}
          onConfirm={async () => {
            await onUnlink({ project });
            setConfirming(false);
          }}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </li>
  );
};
