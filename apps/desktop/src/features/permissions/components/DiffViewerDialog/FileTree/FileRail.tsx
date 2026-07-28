import { useEffect, useMemo, useRef } from 'react';
import { Divider, ScrollArea } from '@goodboy/ui';
import type { FileDiff } from '@goodboy/types';
import type { ReviewState } from '../lib';
import { buildTree } from './tree';
import { TreeNodeView } from './TreeNodeView';

type Props = {
  files: ReadonlyArray<FileDiff>;
  activePath: string | null;
  onSelect: (path: string) => void;
  reviewStateByPath: Map<string, ReviewState>;
  commentCounts: Map<string, number>;
};

export const FileRail = ({
  files,
  activePath,
  onSelect,
  reviewStateByPath,
  commentCounts,
}: Props) => {
  const selectedRef = useRef<HTMLButtonElement>(null);
  const tree = useMemo(() => buildTree(files), [files]);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activePath]);

  return (
    <div className="flex min-h-0 w-[26%] shrink-0">
      <ScrollArea className="min-w-0 flex-1 bg-muted/10">
        <div className="py-1">
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
      <Divider orientation="vertical" />
    </div>
  );
};
