import { ExternalLink, Unplug } from 'lucide-react';
import type { Project } from '@goodboy/types';
import { CopyButton, FOCUS_RING, Tooltip, cn } from '@goodboy/ui';
import { openInEditor } from '../../lib/editor';
import { resolveEditorBinary } from '../../lib/editorSettings';
import { useAppStore } from '../../../store';
import { ICON_SIZE } from '../conceptIcons';
import { NAMES } from '../../names';

type Props = {
  readonly project: Project;
  readonly busy: boolean;
  readonly onArmUnlink: () => void;
};

const actionButtonClass = cn(
  'rounded-md p-1 text-faint-foreground hover:bg-hover hover:text-foreground disabled:opacity-50',
  FOCUS_RING,
);

export const ProjectRowActions = ({ project, busy, onArmUnlink }: Props) => {
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
      <Tooltip content="Open in editor">
        <button
          type="button"
          aria-label={`Open ${project.name} in editor`}
          disabled={busy}
          onClick={(event) => void openProject(event)}
          className={actionButtonClass}
        >
          <ExternalLink size={ICON_SIZE.row} aria-hidden />
        </button>
      </Tooltip>
      <CopyButton
        value={project.rootPath}
        label="path"
        presentation="icon"
        size={ICON_SIZE.row}
        className="text-faint-foreground hover:text-foreground"
      />
      <span className="w-2" aria-hidden />
      <Tooltip content={`${NAMES.removeLink} to ${project.name}`}>
        <button
          type="button"
          aria-label={`${NAMES.removeLink} to ${project.name}`}
          disabled={busy}
          onClick={(event) => {
            event.stopPropagation();
            onArmUnlink();
          }}
          className={cn(actionButtonClass, 'hover:text-danger')}
        >
          <Unplug size={ICON_SIZE.row} aria-hidden />
        </button>
      </Tooltip>
    </span>
  );
};
