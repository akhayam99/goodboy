import type { ChangeEvent, ReactNode, RefObject } from 'react';
import { Paperclip, Target, Undo2 } from 'lucide-react';
import { Textarea, cn, tintClasses } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { ATTACHMENT_ACCEPT } from '../../../../chat/attachment-kinds';

type GoalFiles = {
  readonly attachments: ReactNode;
  readonly isDragging: boolean;
  readonly composerRef: RefObject<HTMLDivElement | null>;
  readonly fileInputRef: RefObject<HTMLInputElement | null>;
  readonly onFiles: (event: ChangeEvent<HTMLInputElement>) => void;
};

type Props = {
  readonly value: string;
  readonly placeholder?: string;
  readonly hasSessionGoal: boolean;
  readonly isSessionGoal: boolean;
  readonly canUndo: boolean;
  readonly isPolishing: boolean;
  readonly disabled: boolean;
  readonly files?: GoalFiles;
  readonly onChange: (value: string) => void;
  readonly onBlur: () => void;
  readonly onUseSessionGoal: () => void;
  readonly onUndo: () => void;
  readonly onPolish: () => void;
};

const TOOL_CLASS =
  'inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-secondary text-muted-foreground transition-colors hover:bg-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50';

const SESSION_PLACEHOLDER =
  'what should this workflow accomplish? same as the session, or a specific sub-objective (e.g. just the auth module)…';

export const GoalField = ({
  value,
  placeholder = SESSION_PLACEHOLDER,
  hasSessionGoal,
  isSessionGoal,
  canUndo,
  isPolishing,
  disabled,
  files,
  onChange,
  onBlur,
  onUseSessionGoal,
  onUndo,
  onPolish,
}: Props) => (
  <div
    ref={files?.composerRef}
    data-drop-composer
    className={cn(
      'flex flex-col gap-1 rounded-lg bg-subtle px-3 pb-1.5 pt-2 ring-1 transition-shadow focus-within:ring-foreground/15',
      files?.isDragging === true
        ? cn('ring-primary', tintClasses('primary').bgSoft)
        : 'ring-border-soft',
    )}
  >
    <label htmlFor="workflow-goal" className="sr-only">
      Goal
    </label>
    <Textarea
      id="workflow-goal"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      autoGrow
      minRows={2}
      maxRows={6}
      disabled={disabled || isPolishing}
      className="resize-none border-0 bg-transparent px-0 py-0 text-body shadow-none focus-visible:ring-0 focus-visible:shadow-none"
    />
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {files === undefined ? null : (
          <>
            <input
              ref={files.fileInputRef}
              type="file"
              accept={ATTACHMENT_ACCEPT}
              multiple
              hidden
              onChange={files.onFiles}
            />
            <button
              type="button"
              onClick={() => files.fileInputRef.current?.click()}
              disabled={disabled}
              className={TOOL_CLASS}
            >
              <Paperclip size={ICON_SIZE.row} aria-hidden /> Add files
            </button>
            {files.attachments}
          </>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {hasSessionGoal ? (
          <button
            type="button"
            onClick={onUseSessionGoal}
            disabled={disabled || isPolishing || isSessionGoal}
            className={TOOL_CLASS}
          >
            <Target size={ICON_SIZE.row} aria-hidden /> Use session goal
          </button>
        ) : null}
        {canUndo ? (
          <button
            type="button"
            onClick={onUndo}
            disabled={disabled || isPolishing}
            aria-label="Undo goal change"
            className={TOOL_CLASS}
          >
            <Undo2 size={ICON_SIZE.row} aria-hidden /> Undo
          </button>
        ) : null}
        <button
          type="button"
          onClick={onPolish}
          disabled={disabled || isPolishing || value.trim().length === 0}
          aria-label="Polish goal"
          className={TOOL_CLASS}
        >
          <CONCEPT_ICONS.enhance size={ICON_SIZE.row} aria-hidden />
          <span className={cn(isPolishing && 'text-shimmer')}>Polish</span>
        </button>
      </div>
    </div>
  </div>
);
