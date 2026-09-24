import type { ChangeEvent, ReactNode, RefObject } from 'react';
import { Paperclip, Target, Undo2 } from 'lucide-react';
import { Textarea, cn, tintClasses } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { ATTACHMENT_ACCEPT } from '../../../../chat/attachment-kinds';

type Props = {
  readonly value: string;
  readonly hasSessionGoal: boolean;
  readonly isSessionGoal: boolean;
  readonly canUndo: boolean;
  readonly isPolishing: boolean;
  readonly isDragging: boolean;
  readonly disabled: boolean;
  readonly attachments: ReactNode;
  readonly composerRef: RefObject<HTMLDivElement | null>;
  readonly fileInputRef: RefObject<HTMLInputElement | null>;
  readonly onChange: (value: string) => void;
  readonly onBlur: () => void;
  readonly onFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onUseSessionGoal: () => void;
  readonly onUndo: () => void;
  readonly onPolish: () => void;
};

const TOOL_CLASS =
  'inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-2xs text-muted-foreground transition-colors hover:bg-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50';

export const GoalField = ({
  value,
  hasSessionGoal,
  isSessionGoal,
  canUndo,
  isPolishing,
  isDragging,
  disabled,
  attachments,
  composerRef,
  fileInputRef,
  onChange,
  onBlur,
  onFiles,
  onUseSessionGoal,
  onUndo,
  onPolish,
}: Props) => (
  <div
    ref={composerRef}
    data-drop-composer
    className={cn(
      'flex flex-col gap-1 rounded-lg bg-subtle px-3 pb-1.5 pt-2 ring-1 transition-shadow focus-within:ring-foreground/15',
      isDragging ? cn('ring-primary', tintClasses('primary').bgSoft) : 'ring-border-soft',
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
      placeholder="what should this workflow accomplish? same as the session, or a specific sub-objective (e.g. just the auth module)…"
      autoGrow
      minRows={2}
      maxRows={6}
      disabled={disabled || isPolishing}
      className="resize-none border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0 focus-visible:shadow-none"
    />
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <input
          ref={fileInputRef}
          type="file"
          accept={ATTACHMENT_ACCEPT}
          multiple
          hidden
          onChange={onFiles}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className={TOOL_CLASS}
        >
          <Paperclip size={ICON_SIZE.row} aria-hidden /> Add files
        </button>
        {attachments}
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
          className={cn(TOOL_CLASS, isPolishing && 'animate-border-pulse')}
        >
          <CONCEPT_ICONS.enhance size={ICON_SIZE.row} aria-hidden /> Polish
        </button>
      </div>
    </div>
  </div>
);
