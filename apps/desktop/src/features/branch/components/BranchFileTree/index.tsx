import { useMemo } from 'react';
import { Check } from 'lucide-react';
import { ScrollFade, cn } from '@goodboy/ui';
import type { FileDiff } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { splitPath } from '../../../diff/lib/fileStatus';
import { fileTreeGroups } from '../../fileTree';

type Props = {
  readonly files: ReadonlyArray<FileDiff>;
  readonly isViewed: (file: FileDiff) => boolean;
  readonly activePath: string | null;
  readonly onPick: (path: string) => void;
};

export const BranchFileTree = ({ files, isViewed, activePath, onPick }: Props) => {
  const groups = useMemo(() => fileTreeGroups({ files }), [files]);
  const viewedCount = files.filter(isViewed).length;
  return (
    <nav aria-label="Changed files" className="flex min-h-0 w-full min-w-0 flex-col">
      <p className="px-3 pb-2 text-meta tabular-nums text-muted-foreground">
        {viewedCount} of {files.length} viewed
      </p>
      <ScrollFade className="min-h-0 flex-1" fadeSize="h-6">
        <ul className="flex min-w-0 flex-col gap-3 px-1 pb-4">
          {groups.map((group) => (
            <li key={group.dir} className="list-none">
              {group.dir !== '' && (
                <p className="truncate px-2 pb-1 font-mono text-code text-faint-foreground">
                  {group.dir}
                </p>
              )}
              <ul className="flex min-w-0 flex-col">
                {group.files.map((file) => {
                  const isActive = file.path === activePath;
                  const viewed = isViewed(file);
                  return (
                    <li key={file.path} className="list-none">
                      <button
                        type="button"
                        aria-current={isActive ? 'true' : undefined}
                        onClick={() => onPick(file.path)}
                        className={cn(
                          'flex w-full min-w-0 items-center gap-2 rounded-sm px-2 py-1 text-left text-body hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                          isActive && 'bg-overlay-selected',
                          viewed ? 'text-muted-foreground' : 'text-foreground',
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">{splitPath(file.path).name}</span>
                        <span className="shrink-0 text-meta tabular-nums text-success">
                          +{file.additions}
                        </span>
                        <span className="shrink-0 text-meta tabular-nums text-danger">
                          −{file.deletions}
                        </span>
                        <span className="flex size-4 shrink-0 items-center justify-center">
                          {viewed && (
                            <Check
                              size={ICON_SIZE.row}
                              aria-label="Viewed"
                              className="text-success"
                            />
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </ScrollFade>
    </nav>
  );
};
