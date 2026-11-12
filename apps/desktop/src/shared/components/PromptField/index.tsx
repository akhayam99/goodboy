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
import { Paperclip } from 'lucide-react';
import { cn, IconButton, SegmentedTabs, Textarea } from '@goodboy/ui';
import { ATTACHMENT_ACCEPT } from '../../../features/chat/attachment-kinds';
import {
  ATTACHMENT_LIMIT,
  type PendingAttachment,
} from '../../../features/attachments/pendingAttachment';
import { useComposerClassicKeys } from '../../hooks/useComposerClassicKeys';
import { ComposerSurface } from '../ComposerSurface';
import { ComposerAttachmentCount } from '../ComposerSurface/ComposerAttachmentCount';
import { ComposerAttachments } from '../ComposerSurface/ComposerAttachments';
import { ComposerFooter } from '../ComposerSurface/ComposerFooter';

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
  readonly accept?: string;
  readonly noun?: string;
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
  readonly model?: ReactNode;
  readonly actions?: ReactNode;
  readonly onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  readonly onBlur?: (event: FocusEvent<HTMLTextAreaElement>) => void;
  readonly onPaste?: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  readonly maxLength?: number;
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
  model,
  actions,
  onKeyDown,
  onBlur,
  onPaste,
  maxLength,
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
  const [chosenTab, setTab] = useState<Tab>('write');
  const tab: Tab = hasPreview ? chosenTab : 'write';
  const [previewText, setPreviewText] = useState('');
  const [previewHeight, setPreviewHeight] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const attachments = files?.attachments ?? [];
  const noun = files?.noun ?? 'files';
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
      onPaste={(event) => {
        onPaste?.(event);
        files?.onPaste(event);
      }}
      maxLength={maxLength}
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
    <div className="flex min-w-0 items-center gap-2 px-2 pt-2">
      <SegmentedTabs
        size="xs"
        ariaLabel="Write or preview"
        options={TAB_OPTIONS}
        value={tab}
        onChange={switchTab}
      />
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

  const hints =
    onSubmit === undefined ? [] : keyHints({ kind: keys, labels: keyLabels, canSendNow });
  const hasFooter =
    files !== undefined ||
    footerStart != null ||
    model != null ||
    actions != null ||
    hints.length > 0;

  return (
    <ComposerSurface
      surfaceRef={(node) => {
        if (files !== undefined) {
          files.composerRef.current = node;
        }
        if (fieldRef !== undefined) {
          fieldRef.current = node;
        }
      }}
      drop={files === undefined ? undefined : { isDragging: files.isDragging }}
      isDisabled={disabled}
      kind={kind}
      className={className}
    >
      {header}
      <ComposerAttachments attachments={attachments} onRemove={(id) => files?.onRemove(id)} />
      {tabs}
      {body}
      {notice !== null && notice !== '' ? (
        <p role="alert" className="px-3 pb-1 text-meta text-warning">
          {notice}
        </p>
      ) : null}
      {hasFooter ? (
        <ComposerFooter
          start={
            <>
              {files !== undefined ? (
                <>
                  <IconButton
                    icon={Paperclip}
                    label={`Attach ${noun}`}
                    {...(files.note !== undefined && { tooltip: files.note })}
                    variant="ghost"
                    disabled={disabled || attachments.length >= ATTACHMENT_LIMIT}
                    onClick={() => files.fileInputRef.current?.click()}
                  />
                  <input
                    ref={files.fileInputRef}
                    type="file"
                    accept={files.accept ?? ATTACHMENT_ACCEPT}
                    multiple
                    aria-label={`Choose ${noun} to attach`}
                    tabIndex={-1}
                    className="hidden"
                    onChange={files.onFileInputChange}
                  />
                </>
              ) : null}
              {footerStart}
              <ComposerAttachmentCount
                count={attachments.length}
                limit={ATTACHMENT_LIMIT}
                noun={noun}
              />
              <PromptKeysHint hints={hints} />
            </>
          }
          end={
            <>
              {model}
              {actions}
            </>
          }
        />
      ) : null}
    </ComposerSurface>
  );
};
