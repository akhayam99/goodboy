import { useState } from 'react';
import { Check, ChevronRight, Copy } from 'lucide-react';
import { cn } from '@goodboy/ui';
import { useToast } from '../../../../../app/components/Toast';
import { STATUS_COLOR, STATUS_GLYPH, type ReviewState } from '../lib';
import type { TreeNode } from './tree';

type Props = {
  node: TreeNode;
  depth: number;
  activePath: string | null;
  onSelect: (path: string) => void;
  selectedRef: React.RefObject<HTMLButtonElement | null>;
  reviewStateByPath: Map<string, ReviewState>;
  commentCounts: Map<string, number>;
};

export const TreeNodeView = ({
  node,
  depth,
  activePath,
  onSelect,
  selectedRef,
  reviewStateByPath,
  commentCounts,
}: Props) => {
  const [expanded, setExpanded] = useState(true);
  const [pathCopied, setPathCopied] = useState(false);
  const { showToast } = useToast();
  const indent = depth * 10;

  const copyPath = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(path).then(
      () => {
        setPathCopied(true);
        showToast('success', 'path copied');
        window.setTimeout(() => setPathCopied(false), 1500);
      },
      () => {
        showToast('error', 'failed to copy path');
      },
    );
  };

  if (node.kind === 'file') {
    const { file } = node;
    const isSelected = file.path === activePath;
    const noteCount = commentCounts.get(file.path) ?? 0;
    const reviewState = reviewStateByPath.get(file.path) ?? 'none';
    return (
      <div
        className={cn(
          'group relative flex w-full items-center gap-2 py-1 pr-1 font-mono text-xs transition-colors',
          isSelected
            ? 'border-l-2 border-primary bg-muted/60 text-foreground'
            : 'border-l-2 border-transparent text-muted-foreground/80 hover:bg-muted/30 hover:text-foreground',
          reviewState === 'reviewed' && !isSelected && 'opacity-50',
        )}
        style={{ paddingLeft: 10 + indent }}
      >
        <button
          ref={isSelected ? selectedRef : null}
          type="button"
          onClick={() => onSelect(file.path)}
          title={file.path}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {reviewState === 'reviewed' ? (
            <Check size={11} aria-hidden className="w-3 shrink-0 text-success" />
          ) : (
            <span
              className={cn(
                'w-3 shrink-0 text-center text-[10px] font-bold',
                STATUS_COLOR[file.status],
              )}
            >
              {STATUS_GLYPH[file.status]}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate">{node.name}</span>
          {reviewState === 'stale' ? (
            <span
              className="shrink-0 rounded-full bg-muted px-1 text-[9px] font-medium text-muted-foreground"
              title="previously reviewed, changed since"
            >
              ↻
            </span>
          ) : null}
          {noteCount > 0 && (
            <span className="shrink-0 rounded-full bg-warning/15 px-1 text-[9px] font-medium text-warning">
              {noteCount}
            </span>
          )}
          <span className="shrink-0 text-[10px] tabular-nums">
            {file.additions > 0 && <span className="text-success">+{file.additions}</span>}
            {file.additions > 0 && file.deletions > 0 && <span className="opacity-40"> </span>}
            {file.deletions > 0 && <span className="text-danger">−{file.deletions}</span>}
          </span>
        </button>
        <button
          type="button"
          onClick={(e) => copyPath(file.path, e)}
          title="copy path"
          aria-label="copy file path"
          className="shrink-0 rounded-sm p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
        >
          {pathCopied ? <Check size={10} aria-hidden /> : <Copy size={10} aria-hidden />}
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-1 py-1 pr-2.5 text-left text-xs text-muted-foreground/60 hover:text-foreground"
        style={{ paddingLeft: 6 + indent }}
        title={node.name}
      >
        <ChevronRight
          size={10}
          aria-hidden
          className={cn('shrink-0 transition-transform duration-150', expanded && 'rotate-90')}
        />
        <span className="min-w-0 flex-1 truncate font-mono">{node.name}</span>
        {!expanded && (node.additions > 0 || node.deletions > 0) ? (
          <span className="shrink-0 text-[10px] tabular-nums">
            {node.additions > 0 && <span className="text-success/70">+{node.additions}</span>}
            {node.additions > 0 && node.deletions > 0 && <span className="opacity-40"> </span>}
            {node.deletions > 0 && <span className="text-danger/70">−{node.deletions}</span>}
          </span>
        ) : null}
      </button>
      {expanded
        ? node.children.map((child, i) => (
            <TreeNodeView
              key={`${child.kind}-${child.name}-${i}`}
              node={child}
              depth={depth + 1}
              activePath={activePath}
              onSelect={onSelect}
              selectedRef={selectedRef}
              reviewStateByPath={reviewStateByPath}
              commentCounts={commentCounts}
            />
          ))
        : null}
    </>
  );
};
