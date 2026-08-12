import { useEffect, useRef, useState } from 'react';
import { Tooltip } from '@goodboy/ui';
import { useCurrentWorkspace } from '../../../../../store';
import { workspaceAccent } from '../../../../workspace/color';
import { WorkspaceSwitcher } from '../../../../workspace/components/WorkspaceSwitcher';
import { shortcutGlyphs } from '../../../../../shared/keyboard/registry';

const initialOf = (name: string): string => name.trim().charAt(0).toUpperCase() || '?';

export const WorkspaceRailBadge = () => {
  const currentWorkspace = useCurrentWorkspace();
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
  const label = `${currentWorkspace.name}, switch workspace (${shortcutGlyphs('workspace.switcher')})`;

  return (
    <>
      <Tooltip content={label} side="right">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          aria-label={label}
          aria-expanded={isOpen}
          className="flex size-8 shrink-0 items-center justify-center rounded-md motion-safe:transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <span
            aria-hidden
            className="flex size-5 items-center justify-center rounded-md text-3xs font-bold text-primary-foreground"
            style={{ backgroundColor: workspaceAccent(currentWorkspace.id) }}
          >
            {initialOf(currentWorkspace.name)}
          </span>
        </button>
      </Tooltip>
      {isOpen ? (
        <WorkspaceSwitcher anchorRef={triggerRef} onClose={() => setIsOpen(false)} />
      ) : null}
    </>
  );
};
