import { useEffect, useMemo, useRef } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn, Divider, ScrollArea, Tooltip } from '@goodboy/ui';
import type { FileDiff } from '@goodboy/types';
import { TOOLBAR_ICON_BTN, type ReviewState } from '../lib';
import { buildTree } from './tree';
import { TreeNodeView } from './TreeNodeView';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';

type Props = {
  files: ReadonlyArray<FileDiff>;
  activePath: string | null;
  onSelect: (path: string) => void;
  reviewStateByPath: Map<string, ReviewState>;
  commentCounts: Map<string, number>;
  collapsed: boolean;
  onToggle: () => void;
};

export const FileRail = ({
  files,
  activePath,
  onSelect,
  reviewStateByPath,
  commentCounts,
  collapsed,
  onToggle,
}: Props) => {
  const selectedRef = useRef<HTMLButtonElement>(null);
  const tree = useMemo(() => buildTree(files), [files]);

  useEffect(() => {
    if (!collapsed) {
      selectedRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [activePath, collapsed]);

  return (
    <div className={cn('flex min-h-0 shrink-0', collapsed ? 'w-9' : 'w-[26%]')}>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-end px-1.5 pt-1.5">
          <Tooltip content={collapsed ? 'Show file list' : 'Hide file list'}>
            <button
              type="button"
              onClick={onToggle}
              className={TOOLBAR_ICON_BTN}
              aria-label={collapsed ? 'Show file list' : 'Hide file list'}
              aria-expanded={!collapsed}
            >
              {collapsed ? (
                <PanelLeftOpen size={ICON_SIZE.row} />
              ) : (
                <PanelLeftClose size={ICON_SIZE.row} />
              )}
            </button>
          </Tooltip>
        </div>
        {collapsed ? null : (
          <ScrollArea className="min-w-0 flex-1">
            <div className="pb-1">
              {tree.kind === 'dir' &&
                tree.children.map((child, i) => (
                  <TreeNodeView
                    key={`${child.kind}-${child.name}-${i}`}
                    node={child}
                    depth={0}
                    activePath={activePath}
                    onSelect={onSelect}
                    selectedRef={selectedRef}
                    reviewStateByPath={reviewStateByPath}
                    commentCounts={commentCounts}
                  />
                ))}
            </div>
          </ScrollArea>
        )}
      </div>
      <Divider orientation="vertical" />
    </div>
  );
};
