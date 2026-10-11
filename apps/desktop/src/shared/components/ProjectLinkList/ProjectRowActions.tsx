import { ExternalLink, Unplug } from 'lucide-react';
import type { Project } from '@goodboy/types';
import { CopyButton, IconButton } from '@goodboy/ui';
import { openInEditor } from '../../lib/editor';
import { resolveEditorBinary } from '../../lib/editorSettings';
import { useAppStore } from '../../../store';
import { ICON_SIZE } from '../conceptIcons';
import { NAMES } from '../../names';

type Props = {
  readonly project: Project;
  readonly busy: boolean;
  readonly onUnlink: () => void;
};

export const ProjectRowActions = ({ project, busy, onUnlink }: Props) => {
  const reportError = useAppStore((state) => state.reportError);
  const editor = useAppStore((state) => resolveEditorBinary({ settings: state.settings }));

  const openProject = async (event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await openInEditor({ path: project.rootPath, editor });
    } catch (error) {
      void reportError({ title: `Couldn't open ${project.name}`, error });
    }
  };

  return (
    <span className="flex shrink-0 items-center gap-0.5 text-faint-foreground">
      <IconButton
        icon={ExternalLink}
        label={`Open ${project.name} in editor`}
        tooltip="Open in editor"
        size="xs"
        disabled={busy}
        onClick={(event) => void openProject(event)}
      />
      <CopyButton
        value={project.rootPath}
        label="path"
        presentation="icon"
        size={ICON_SIZE.row}
        className="text-faint-foreground hover:text-foreground"
      />
      <span className="w-2" aria-hidden />
      <IconButton
        icon={Unplug}
        label={`${NAMES.removeLink} to ${project.name}`}
        size="xs"
        disabled={busy}
        onClick={(event) => {
          event.stopPropagation();
          onUnlink();
        }}
        className="hover:text-danger"
      />
    </span>
  );
};
