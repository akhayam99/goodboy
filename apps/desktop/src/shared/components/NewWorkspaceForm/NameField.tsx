import { useRef, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { ICON_SIZE, cn, useEscapeLayer } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../conceptIcons';
import { workspaceAccent } from '../../../features/workspace/color';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  readonly sourceName: string | null;
  readonly isBusy: boolean;
  readonly onNameChange: (name: string) => void;
};

const RenameIcon = CONCEPT_ICONS.rename;

const PLACEHOLDER = 'Workspace name';

export const NameField = ({ workspaceId, name, sourceName, isBusy, onNameChange }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [nameBeforeEdit, setNameBeforeEdit] = useState(name);
  const initial = name.trim().charAt(0).toUpperCase();

  useEscapeLayer(() => {
    onNameChange(nameBeforeEdit);
    inputRef.current?.blur();
  }, isEditing);

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-1">
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-heading text-on-tone"
          style={{ backgroundColor: workspaceAccent(workspaceId) }}
        >
          {initial === '' ? '?' : initial}
        </span>
        <label
          className={cn(
            'flex h-8 min-w-0 cursor-text items-center gap-2 rounded-md px-2 motion-safe:transition-colors',
            'hover:bg-hover focus-within:bg-transparent focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary',
          )}
        >
          <span className="inline-grid min-w-0 max-w-80">
            <span
              aria-hidden
              className="invisible col-start-1 row-start-1 overflow-hidden whitespace-pre text-title"
            >
              {name === '' ? PLACEHOLDER : name}
            </span>
            <input
              ref={inputRef}
              value={name}
              disabled={isBusy}
              size={1}
              aria-label="Workspace name"
              placeholder={PLACEHOLDER}
              spellCheck={false}
              onFocus={() => {
                setNameBeforeEdit(name);
                setIsEditing(true);
              }}
              onBlur={() => setIsEditing(false)}
              onChange={(event) => onNameChange(event.target.value)}
              className="col-start-1 row-start-1 w-full min-w-0 bg-transparent text-title text-foreground outline-none placeholder:text-faint-foreground"
            />
          </span>
          <RenameIcon size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
        </label>
      </div>
      {sourceName === null ? null : (
        <span className="shrink-0 text-meta text-faint-foreground">From {sourceName}</span>
      )}
    </div>
  );
};
