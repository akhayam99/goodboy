import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Settings } from 'lucide-react';
import { Divider, EmptyState, Popover, ScrollFade } from '@goodboy/ui';
import type { Workspace } from '@goodboy/types';
import { useAppStore, useWorkspaces } from '../../../../store';
import { WorkspaceRow } from '../WorkspaceRow';
import { filterWorkspaces, sortWorkspacesByRecent } from '../../recent';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly anchorRef: RefObject<HTMLElement | null>;
  readonly onClose: () => void;
};

type Coordinates = {
  readonly top?: number;
  readonly bottom?: number;
  readonly left: number;
};

const PANEL_WIDTH = 288;
const VIEWPORT_MARGIN = 8;
const PANEL_MAX_HEIGHT = 420;

const actionClass =
  'flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground';

export const WorkspaceSwitcher = ({ anchorRef, onClose }: Props) => {
  const workspaces = useWorkspaces();
  const openWorkspace = useAppStore((s) => s.openWorkspace);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(
    () => filterWorkspaces(sortWorkspacesByRecent(workspaces), query),
    [workspaces, query],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useLayoutEffect(() => {
    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (anchor == null) {
        return;
      }
      const rect = anchor.getBoundingClientRect();
      const maxLeft = window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN;
      const left = Math.min(
        Math.max(rect.left, VIEWPORT_MARGIN),
        Math.max(maxLeft, VIEWPORT_MARGIN),
      );
      const spaceBelow = window.innerHeight - rect.bottom;
      const shouldOpenAbove = spaceBelow < PANEL_MAX_HEIGHT + VIEWPORT_MARGIN;
      setCoordinates({
        top: shouldOpenAbove ? undefined : rect.bottom + 6,
        bottom: shouldOpenAbove ? window.innerHeight - rect.top + 6 : undefined,
        left,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRef]);

  const select = (workspace: Workspace) => {
    void openWorkspace(workspace.id, workspace.name);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const picked = filtered[activeIndex];
      if (picked) {
        select(picked);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (coordinates == null) {
    return null;
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-30" onMouseDown={onClose} aria-hidden />
      <Popover
        role="dialog"
        ariaLabel="Switch or open a workspace"
        className="fixed z-40 flex flex-col"
        style={{
          top: coordinates.top,
          bottom: coordinates.bottom,
          left: coordinates.left,
          width: PANEL_WIDTH,
        }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Switch or open a workspace…"
          aria-label="Filter workspaces"
          className="w-full bg-transparent px-3 py-2.5 text-xs focus-visible:outline-none"
        />
        <Divider />
        <ScrollFade className="max-h-72" viewportClassName="p-1">
          <ul>
            {filtered.length === 0 ? (
              <li>
                <EmptyState
                  icon={CONCEPT_ICONS.workspace}
                  tone={CONCEPT_TONE.workspace}
                  title="No workspaces"
                  size="inline"
                  className="px-3 py-5"
                />
              </li>
            ) : (
              filtered.map((w, i) => (
                <li key={w.id}>
                  <WorkspaceRow
                    workspace={w}
                    density="row"
                    highlighted={i === activeIndex}
                    onOpen={() => select(w)}
                  />
                </li>
              ))
            )}
          </ul>
        </ScrollFade>
        <Divider />
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('goodboy:open-workspace-settings'));
            onClose();
          }}
          className={actionClass}
        >
          <Settings size={13} aria-hidden />
          Workspace settings
        </button>
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('goodboy:add-workspace'));
            onClose();
          }}
          className={actionClass}
        >
          <Plus size={13} aria-hidden />
          New workspace
        </button>
      </Popover>
    </>,
    document.body,
  );
};
