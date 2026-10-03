import {
  Suspense,
  lazy,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { ImageIcon, Paperclip } from 'lucide-react';
import { IconButton, SegmentedTabs, Textarea, cn, tintClasses } from '@goodboy/ui';
import { ATTACHMENT_ACCEPT } from '../../../features/chat/attachment-kinds';
import {
  ATTACHMENT_LIMIT,
  type PendingAttachment,
} from '../../../features/attachments/pendingAttachment';
import { useComposerClassicKeys } from '../../hooks/useComposerClassicKeys';
import { ICON_SIZE } from '../conceptIcons';
import { PromptAttachmentChip } from './PromptAttachmentChip';
import { PromptDropOverlay } from './PromptDropOverlay';
import { PromptKeysHint, type PromptKeyHint } from './PromptKeysHint';
import { effectiveKind, promptKeyAction, type PromptFieldKind } from './promptKeyAction';

const PromptPreview = lazy(() =>
  import('./PromptPreview').then((module) => ({ default: module.PromptPreview })),
);

export type PromptSubmitMode = 'send' | 'now';

export type PromptFieldFiles = {
  readonly attachments: ReadonlyArray<PendingAttachment>;
  readonly isDragging: boolean;
  readonly composerRef: RefObject<HTMLDivElement | null>;
  readonly fileInputRef: RefObject<HTMLInputElement | null>;
  readonly onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  readonly onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onRemove: (id: string) => void;
  readonly note?: string;
};

type PromptKeyLabels = {
  readonly send: string;
  readonly now?: string;
};

type Tab = 'write' | 'preview';

type Props = {
  readonly kind: PromptFieldKind;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSubmit?: (mode: PromptSubmitMode) => void;
  readonly canSendNow?: boolean;
  readonly isSubmitBlocked?: boolean;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly files?: PromptFieldFiles;
  readonly hasPreview?: boolean;
  readonly notice?: string | null;
  readonly hasChangedKeys?: boolean;
  readonly keyLabels?: PromptKeyLabels;
  readonly minRows?: number;
  readonly maxRows?: number;
  readonly variant?: 'card' | 'bare';
  readonly header?: ReactNode;
  readonly footerStart?: ReactNode;
  readonly actions?: ReactNode;
  readonly onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  readonly onBlur?: (event: FocusEvent<HTMLTextAreaElement>) => void;
  readonly fieldRef?: RefObject<HTMLDivElement | null>;
  readonly autoFocus?: boolean;
  readonly id?: string;
  readonly testId?: string;
  readonly isKickoffField?: boolean;
  readonly className?: string;
  readonly textClassName?: string;
};

type HintsParams = {
  readonly kind: PromptFieldKind;
  readonly labels: PromptKeyLabels | undefined;
  readonly canSendNow: boolean;
};

const keyHints = ({ kind, labels, canSendNow }: HintsParams): ReadonlyArray<PromptKeyHint> => {
  if (labels === undefined) {
    return [];
  }
  if (kind === 'document') {
    return [
      { id: 'composer.send', label: 'new line' },
      { id: 'composer.submit', label: labels.send },
    ];
  }
  const hints: PromptKeyHint[] = [
    { id: 'composer.send', label: labels.send },
    { id: 'composer.newLine', label: 'new line' },
  ];
  if (canSendNow && labels.now !== undefined) {
    hints.push({ id: 'composer.submit', label: labels.now });
  }
  return hints;
};

const TAB_OPTIONS = [
  { value: 'write', label: 'Write' },
  { value: 'preview', label: 'Preview' },
] as const satisfies ReadonlyArray<{ readonly value: Tab; readonly label: string }>;

export const PromptField = ({
  kind,
  label,
  value,
  onChange,
  onSubmit,
  canSendNow = false,
  isSubmitBlocked = false,
  placeholder,
  disabled = false,
  files,
  hasPreview = false,
  notice = null,
  hasChangedKeys = false,
  keyLabels,
  minRows = 2,
  maxRows = 12,
  variant = 'card',
  header,
  footerStart,
  actions,
  onKeyDown,
  onBlur,
  fieldRef,
  autoFocus,
  id,
  testId,
  isKickoffField = false,
  className,
  textClassName,
}: Props) => {
  const isClassic = useComposerClassicKeys({ isEnabled: hasChangedKeys });
  const keys = effectiveKind({ kind, isClassic });
  const [tab, setTab] = useState<Tab>('write');
  const [previewText, setPreviewText] = useState('');
  const [previewHeight, setPreviewHeight] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const attachments = files?.attachments ?? [];
  const isCard = variant === 'card';

  const switchTab = (next: Tab) => {
    if (next === 'preview') {
      setPreviewText(value);
      setPreviewHeight(bodyRef.current?.querySelector('textarea')?.offsetHeight ?? 0);
    }
    setTab(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || isSubmitBlocked || onSubmit === undefined) {
      return;
    }
    const action = promptKeyAction({
      event: {
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        isComposing: event.nativeEvent.isComposing,
      },
      kind,
      canSendNow,
      isClassic,
    });
    if (action === 'none') {
      return;
    }
    event.preventDefault();
    onSubmit(action);
  };

  const textarea = (
    <Textarea
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={handleKeyDown}
      onPaste={files?.onPaste}
      onBlur={onBlur}
      placeholder={placeholder}
      aria-label={label}
      disabled={disabled}
      autoFocus={autoFocus}
      data-testid={testId}
      data-prompt-kind={kind}
      data-prompt-keys={keys}
      {...(isKickoffField ? { 'data-kickoff-field': true } : {})}
      autoGrow
      rows={minRows}
      minRows={minRows}
      maxRows={maxRows}
      className={cn(
        'resize-none border-0 bg-transparent px-3 py-2 text-body text-foreground shadow-none placeholder:text-faint-foreground focus-visible:border-0 focus-visible:shadow-none focus-visible:ring-0 focus-visible:outline-none',
        textClassName,
      )}
    />
  );

  const body = (
    <div ref={bodyRef} className="min-w-0">
      {tab === 'write' ? (
        textarea
      ) : (
        <Suspense fallback={<div style={{ minHeight: previewHeight }} />}>
          <PromptPreview text={previewText} minHeight={previewHeight} />
        </Suspense>
      )}
    </div>
  );

  const tabs = hasPreview ? (
    <div className="flex min-w-0 items-center gap-2 px-2 pt-1.5">
      <SegmentedTabs
        size="xs"
        ariaLabel="Write or preview"
        options={TAB_OPTIONS}
        value={tab}
        onChange={switchTab}
      />
      <span className="flex-1" />
      {files?.note !== undefined ? (
        <span className="flex min-w-0 items-center gap-1 truncate text-secondary text-faint-foreground">
          <ImageIcon size={ICON_SIZE.row} aria-hidden />
          {files.note}
        </span>
      ) : null}
    </div>
  ) : null;

  if (!isCard) {
    return (
      <div ref={fieldRef} className={cn('min-w-0', className)}>
        {tabs}
        {body}
      </div>
    );
  }

  const hints = keyHints({ kind: keys, labels: keyLabels, canSendNow });

  return (
    <div
      ref={(node) => {
        if (files !== undefined) {
          files.composerRef.current = node;
        }
        if (fieldRef !== undefined) {
          fieldRef.current = node;
        }
      }}
      data-drop-composer={files === undefined ? undefined : true}
      data-prompt-field={kind}
      className={cn(
        '@container/prompt relative flex min-w-0 flex-col rounded-lg border transition-colors',
        files?.isDragging === true
          ? cn(tintClasses('primary').bgSoft, 'border-primary')
          : 'border-border-soft bg-subtle hover:border-border focus-within:border-border-strong',
        disabled && 'opacity-60',
        className,
      )}
    >
      {files !== undefined ? <PromptDropOverlay isDragging={files.isDragging} /> : null}
      {header}
      {tabs}
      {body}
      {attachments.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 px-2.5 pb-1.5 pt-0.5">
          {attachments.map((attachment) => (
            <PromptAttachmentChip
              key={attachment.id}
              attachment={attachment}
              onRemove={() => files?.onRemove(attachment.id)}
            />
          ))}
        </div>
      ) : null}
      {notice !== null && notice !== '' ? (
        <p role="alert" className="px-3 pb-1.5 text-secondary text-warning">
          {notice}
        </p>
      ) : null}
      <div className="flex min-h-8 min-w-0 items-center gap-2 px-1.5 pb-1.5">
        {files !== undefined ? (
          <>
            <IconButton
              icon={Paperclip}
              label="Attach files"
              variant="ghost"
              iconSize={ICON_SIZE.control}
              disabled={disabled || attachments.length >= ATTACHMENT_LIMIT}
              onClick={() => files.fileInputRef.current?.click()}
            />
            <input
              ref={files.fileInputRef}
              type="file"
              accept={ATTACHMENT_ACCEPT}
              multiple
              aria-label="Choose files to attach"
              tabIndex={-1}
              className="hidden"
              onChange={files.onFileInputChange}
            />
          </>
        ) : null}
        {footerStart}
        <PromptKeysHint hints={hints} />
        <span className="flex-1" />
        {attachments.length > 0 ? (
          <span className="shrink-0 text-secondary tabular-nums text-faint-foreground">
            {`${attachments.length} of ${ATTACHMENT_LIMIT} files`}
          </span>
        ) : null}
        {actions}
      </div>
    </div>
  );
};
