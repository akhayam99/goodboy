import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronRight, Search, ShieldCheck } from 'lucide-react';
import { cn } from '../../cn';
import { FOCUS_RING } from '../../focusRing';
import { useEscapeLayer } from '../../useEscapeLayer';
import { Button } from '../Button';
import { CopyButton } from '../CopyButton';
import { FormActions } from '../FormActions';
import { Kbd } from '../Kbd';
import { KeyHint } from '../KeyHint';
import { ScrollFade } from '../ScrollFade';
import { Textarea } from '../Textarea';
import { AttachmentChip, type ReportSheetAttachment } from './AttachmentChip';
import { ICON_SIZE } from '../../iconSize';

export type { ReportSheetAttachment } from './AttachmentChip';

export type ReportSheetDuplicate = {
  readonly number: number;
  readonly title: string;
  readonly meta: string;
};

export type ReportSheetVariant = 'floating' | 'inline';

export type ReportSheetProps = {
  readonly heading: string;
  readonly icon?: ReactNode;
  readonly typeControl?: ReactNode;
  readonly variant?: ReportSheetVariant;
  readonly line: string;
  readonly linePlaceholder: string;
  readonly onLineChange: (line: string) => void;
  readonly detail: string;
  readonly detailPlaceholder: string;
  readonly onDetailChange: (detail: string) => void;
  readonly attachments: ReadonlyArray<ReportSheetAttachment>;
  readonly onToggleAttachment: (id: string) => void;
  readonly preview: string;
  readonly previewSummary: string;
  readonly neverSent: string;
  readonly duplicate?: ReportSheetDuplicate | null;
  readonly isAddingToDuplicate?: boolean;
  readonly onAddToDuplicate?: () => void;
  readonly destination: ReactNode;
  readonly submitLabel: string;
  readonly submitIcon?: ReactNode;
  readonly submitHint?: string;
  readonly isSubmitting: boolean;
  readonly canSubmit: boolean;
  readonly onSubmit: () => void;
  readonly error?: string | null;
  readonly onClose?: () => void;
  readonly selectLineOnMount?: boolean;
  readonly className?: string;
};

const VARIANT_CLASSES: Readonly<Record<ReportSheetVariant, string>> = {
  floating: 'bg-floating shadow-lg',
  inline: 'bg-subtle',
};

const isSubmitCombo = (event: KeyboardEvent<HTMLElement>): boolean =>
  event.key === 'Enter' && (event.metaKey || event.ctrlKey);

export const ReportSheet = ({
  heading,
  icon,
  typeControl,
  variant = 'floating',
  line,
  linePlaceholder,
  onLineChange,
  detail,
  detailPlaceholder,
  onDetailChange,
  attachments,
  onToggleAttachment,
  preview,
  previewSummary,
  neverSent,
  duplicate = null,
  isAddingToDuplicate = false,
  onAddToDuplicate,
  destination,
  submitLabel,
  submitIcon,
  submitHint = '⌘↵',
  isSubmitting,
  canSubmit,
  onSubmit,
  error = null,
  onClose,
  selectLineOnMount = false,
  className,
}: ReportSheetProps) => {
  const lineRef = useRef<HTMLInputElement>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(detail !== '');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [shouldFocusDetail, setShouldFocusDetail] = useState(false);
  const previewId = useId();
  const headingId = useId();

  useEscapeLayer(() => onClose?.(), onClose != null);

  useEffect(() => {
    const input = lineRef.current;
    if (input == null) {
      return;
    }
    input.focus();
    if (selectLineOnMount) {
      input.select();
    }
  }, [selectLineOnMount]);

  const openDetail = () => {
    setIsDetailOpen(true);
    setShouldFocusDetail(true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!isSubmitCombo(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (canSubmit && !isSubmitting) {
      onSubmit();
    }
  };

  const onLineKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Tab' || event.shiftKey || isDetailOpen) {
      return;
    }
    event.preventDefault();
    openDetail();
  };

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby={headingId}
      data-testid="report-sheet"
      onKeyDown={onKeyDown}
      className={cn(
        'flex w-full flex-col rounded-lg border border-border text-foreground',
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      <header className="flex items-center gap-2 px-3 pb-1 pt-3">
        {icon != null ? (
          <span className="inline-flex shrink-0 text-muted-foreground" aria-hidden>
            {icon}
          </span>
        ) : null}
        <h2 id={headingId} className="text-heading">
          {heading}
        </h2>
        {typeControl}
        <span className="flex-1" />
        {onClose != null ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close report"
            className={cn('rounded-sm', FOCUS_RING)}
          >
            <Kbd look="cap">esc</Kbd>
          </button>
        ) : null}
      </header>
      <div className="flex flex-col gap-2 px-3 pb-3">
        <input
          ref={lineRef}
          aria-label="What went wrong, in one line"
          value={line}
          onChange={(event) => onLineChange(event.target.value)}
          onKeyDown={onLineKeyDown}
          placeholder={linePlaceholder}
          className="h-9 w-full bg-transparent text-body text-foreground placeholder:text-faint-foreground focus-visible:outline-none"
        />
        {isDetailOpen ? (
          <Textarea
            autoFocus={shouldFocusDetail}
            autoGrow
            minRows={3}
            maxRows={8}
            aria-label="Detail"
            value={detail}
            onChange={(event) => onDetailChange(event.target.value)}
            placeholder={detailPlaceholder}
          />
        ) : null}
        {duplicate != null ? (
          <div className="flex items-center gap-2 rounded-md bg-fill px-2 py-1 text-chip">
            <Search size={ICON_SIZE.row} aria-hidden className="shrink-0 text-info" />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              Looks like{' '}
              <span className="text-foreground">
                #{duplicate.number} {duplicate.title}
              </span>{' '}
              · {duplicate.meta}
            </span>
            {onAddToDuplicate != null ? (
              <Button
                variant="secondary"
                size="sm"
                isBusy={isAddingToDuplicate}
                disabled={isSubmitting}
                onClick={onAddToDuplicate}
              >
                Add mine there
              </Button>
            ) : null}
          </div>
        ) : null}
        {attachments.length > 0 ? (
          <ul aria-label="Attached" className="flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <li key={attachment.id}>
                <AttachmentChip attachment={attachment} onToggle={onToggleAttachment} />
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-col">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-expanded={isPreviewOpen}
              aria-controls={previewId}
              onClick={() => setIsPreviewOpen((open) => !open)}
              className={cn(
                'inline-flex min-w-0 items-center gap-1 rounded-sm py-0.5 text-meta text-muted-foreground hover:text-foreground',
                FOCUS_RING,
              )}
            >
              <ChevronRight
                size={ICON_SIZE.row}
                aria-hidden
                className={cn(
                  'shrink-0 motion-safe:transition-transform motion-safe:duration-120',
                  isPreviewOpen ? 'rotate-90' : '',
                )}
              />
              <ShieldCheck size={ICON_SIZE.row} aria-hidden className="shrink-0 text-success" />
              <span className="text-foreground">What gets sent</span>
              <span className="truncate text-faint-foreground">· {previewSummary}</span>
            </button>
            <span className="flex-1" />
            {isPreviewOpen ? (
              <CopyButton value={preview} label="Copy what gets sent" size={ICON_SIZE.row} />
            ) : null}
          </div>
          {isPreviewOpen ? (
            <div id={previewId} className="mt-2 flex flex-col gap-2">
              <ScrollFade
                className="max-h-60 rounded-md bg-muted"
                viewportClassName="px-3 py-2"
                fadeFrom="muted"
              >
                <pre
                  aria-label="What gets sent"
                  className="whitespace-pre-wrap break-words font-mono text-code text-foreground"
                >
                  {preview}
                </pre>
              </ScrollFade>
              <p className="text-meta text-faint-foreground">{neverSent}</p>
            </div>
          ) : null}
        </div>
      </div>
      <FormActions
        className="px-3 pb-3"
        leading={
          <div className="min-w-0 text-meta text-muted-foreground">
            {error != null ? (
              <span role="alert" className="text-danger">
                {error}
              </span>
            ) : (
              destination
            )}
          </div>
        }
      >
        {isDetailOpen ? null : (
          <Button variant="ghost" size="sm" onClick={openDetail}>
            Add detail
            <KeyHint keys="⇥" />
          </Button>
        )}
        <Button
          size="sm"
          onClick={onSubmit}
          disabled={!canSubmit}
          isBusy={isSubmitting}
          busyLabel={`${submitLabel}…`}
        >
          {submitLabel}
          {submitIcon}
          <KeyHint keys={submitHint} onTone />
        </Button>
      </FormActions>
    </section>
  );
};
