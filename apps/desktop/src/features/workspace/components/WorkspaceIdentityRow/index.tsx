import { useEffect, useRef, useState } from 'react';
import { ChevronsUpDown, SlidersHorizontal } from 'lucide-react';
import { StatusDot, Tooltip } from '@goodboy/ui';
import { useAppStore, useCurrentWorkspace, useHasUnreadElsewhere } from '../../../../store';
import { workspaceAccent } from '../../color';
import { primaryProjectRoot } from '../../primaryProjectRoot';
import { WorkspaceSwitcher } from '../WorkspaceSwitcher';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';

const initialOf = (name: string): string => name.trim().charAt(0).toUpperCase() || '?';

const basenameOf = (path: string): string => path.replace(/\/+$/, '').split('/').pop() || path;

export const WorkspaceIdentityRow = () => {
  const currentWorkspace = useCurrentWorkspace();
  const projectCount = useAppStore(
    (state) =>
      state.projects.filter((project) => project.workspaceId === currentWorkspace?.id).length,
  );
  const projectRoot = useAppStore((state) =>
    currentWorkspace == null
      ? null
      : primaryProjectRoot({ projects: state.projects, workspaceId: currentWorkspace.id }),
  );
  const hasUnreadElsewhere = useHasUnreadElsewhere(currentWorkspace?.id ?? null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener('goodboy:open-workspace-switcher', open);
    return () => window.removeEventListener('goodboy:open-workspace-switcher', open);
  }, []);

  if (!currentWorkspace) {
    return null;
  }
  const accent = workspaceAccent(currentWorkspace.id);
  const subtitle = projectCount > 1 ? `${projectCount} projects` : basenameOf(projectRoot ?? '');

  return (
    <div className="flex w-full min-w-0 items-center gap-0.5">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        data-tauri-drag-region="false"
        aria-label="Switch or open a workspace"
        aria-expanded={isOpen}
        className="group flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-muted/50"
        title={`${currentWorkspace.name}, ${subtitle} (${shortcutGlyphs('workspace.switcher')})`}
      >
        <span
          aria-hidden
          className="flex size-5 shrink-0 items-center justify-center rounded-md text-3xs font-bold text-primary-foreground ring-1 ring-inset ring-border-soft"
          style={{ backgroundColor: accent }}
        >
          {initialOf(currentWorkspace.name)}
        </span>
        <span className="truncate text-xs font-semibold leading-tight text-foreground">
          {currentWorkspace.name}
        </span>
        {hasUnreadElsewhere ? (
          <StatusDot tone="warning" size="sm" title="Activity in another workspace" />
        ) : null}
        <ChevronsUpDown
          size={12}
          aria-hidden
          className="shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground"
        />
      </button>
      <Tooltip content="Preferences" side="bottom">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('goodboy:open-workspace-settings'))}
          aria-label="Preferences"
          className="flex shrink-0 items-center justify-center rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          <SlidersHorizontal size={12} aria-hidden />
        </button>
      </Tooltip>
      {isOpen ? (
        <WorkspaceSwitcher anchorRef={triggerRef} onClose={() => setIsOpen(false)} />
      ) : null}
    </div>
  );
};
