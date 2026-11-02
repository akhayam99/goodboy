import { ScrollFade, SelectableRow } from '@goodboy/ui';
import { countNoun } from '../../../../shared/utils/countNoun';
import { splitPeekPath } from '../IdentifierPeek/splitPeekPath';
import type { PeekFile, PeekFileGroup } from './peekFiles';

type Props = {
  readonly groups: ReadonlyArray<PeekFileGroup>;
  readonly selectedPath: string;
  readonly onSelect: (file: PeekFile) => void;
};

export const PeekFileList = ({ groups, selectedPath, onSelect }: Props) => (
  <ScrollFade className="max-h-52" viewportClassName="max-h-52">
    <div className="flex flex-col gap-3 px-3 py-2">
      {groups.map((group) => (
        <div key={group.key} role="group" aria-label={group.label} className="flex flex-col gap-1">
          <h3 className="px-2 text-eyebrow text-faint-foreground">{group.label}</h3>
          <div className="flex flex-col">
            {group.files.map((file) => {
              const { directory, separator, name } = splitPeekPath({ path: file.path });
              const isSelected = file.path === selectedPath;
              return (
                <SelectableRow
                  key={`${group.key}:${file.path}`}
                  selected={isSelected}
                  ariaCurrent={isSelected ? 'true' : undefined}
                  ariaLabel={`${file.path}:${file.line}`}
                  title={file.path}
                  onClick={() => onSelect(file)}
                  className="grid min-h-8 grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-2 px-2 text-meta"
                >
                  <span className="text-faint-foreground">
                    {directory}
                    {separator}
                  </span>
                  <span className="min-w-0 truncate text-foreground">{name}</span>
                  <span className="tabular-nums text-faint-foreground">
                    {countNoun({ count: file.count, one: 'use' })}
                  </span>
                </SelectableRow>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  </ScrollFade>
);
