import { ScrollFade, SelectableRow, StateBadge } from '@goodboy/ui';
import { countNoun } from '../../../../shared/utils/countNoun';
import { PeekPath } from '../IdentifierPeek/PeekPath';
import type { PeekFile, PeekFileGroup } from './peekFiles';

type Props = {
  readonly groups: ReadonlyArray<PeekFileGroup>;
  readonly selectedPath: string;
  readonly onSelect: (file: PeekFile) => void;
};

export const PeekFileList = ({ groups, selectedPath, onSelect }: Props) => (
  <ScrollFade className="max-h-64" viewportClassName="max-h-64">
    <div className="flex flex-col gap-2 px-3 py-2">
      {groups.map((group) => (
        <div key={group.key} role="group" aria-label={group.label} className="flex flex-col gap-1">
          <h3 className="px-2 text-eyebrow text-faint-foreground">{group.label}</h3>
          <div className="flex flex-col">
            {group.files.map((file) => {
              const isSelected = file.path === selectedPath;
              return (
                <SelectableRow
                  key={file.path}
                  selected={isSelected}
                  ariaCurrent={isSelected ? 'true' : undefined}
                  ariaLabel={`${file.path}:${file.line}`}
                  title={file.path}
                  onClick={() => onSelect(file)}
                  className="grid min-h-7 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2 text-meta"
                >
                  <PeekPath path={file.path} />
                  <span className="flex items-center gap-2">
                    {group.key === 'definitions' && file.isChanged ? (
                      <StateBadge tone="info">Changed</StateBadge>
                    ) : null}
                    <span className="tabular-nums text-faint-foreground">
                      {countNoun({ count: file.count, one: 'use' })}
                    </span>
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
