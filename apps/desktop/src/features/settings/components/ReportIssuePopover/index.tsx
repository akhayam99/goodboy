import { Button, Divider, Popover, SegmentedTabs, Textarea, Tooltip, cn } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { DropdownPortal } from '../../../../shared/hooks/useDropdown/DropdownPortal';
import { useDropdown } from '../../../../shared/hooks/useDropdown';
import { useAppStore } from '../../../../store';
import { emptyBugReportDraft } from '../../../../store/slices/bugReportDraft/state';
import { ISSUE_TYPE_OPTIONS, type IssueTypeValue } from '../../reportIssueTypes';
import { REPORT_ISSUE_STUDIO_EVENT } from '../../reportIssueStudioEvent';

const TRIGGER_LABEL = 'Report an issue';
const DRAFT_TRIGGER_LABEL = 'Report an issue, draft saved';

export const ReportIssuePopover = () => {
  const {
    open,
    close,
    toggle,
    containerRef,
    popupRef,
    popupClassName,
    popupStyle,
    portal,
    portalTarget,
  } = useDropdown({
    align: 'end',
    expectedHeight: 340,
    expectedWidth: 384,
    width: 'w-96 max-w-[calc(100vw-2rem)]',
    strategy: 'fixed',
  });
  const draft = useAppStore((s) => s.bugReportDraft);
  const setBugReportDraft = useAppStore((s) => s.setBugReportDraft);
  const clearBugReportDraft = useAppStore((s) => s.clearBugReportDraft);

  const hasDraft = draft.description !== '' || draft.issueType !== emptyBugReportDraft.issueType;
  const triggerLabel = hasDraft ? DRAFT_TRIGGER_LABEL : TRIGGER_LABEL;
  const ReportIssueIcon = CONCEPT_ICONS.reportIssue;

  const openFullForm = () => {
    close();
    window.dispatchEvent(new CustomEvent(REPORT_ISSUE_STUDIO_EVENT));
  };

  return (
    <div ref={containerRef} className="relative">
      <Tooltip content={TRIGGER_LABEL} side="top">
        <button
          type="button"
          onClick={toggle}
          aria-label={triggerLabel}
          className={cn(
            'relative flex items-center justify-center rounded p-1.5 motion-safe:transition-colors',
            open
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
          )}
        >
          <ReportIssueIcon size={14} aria-hidden />
          {hasDraft && (
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-info"
            />
          )}
        </button>
      </Tooltip>

      <DropdownPortal portal={portal} portalTarget={portalTarget}>
        {open && (
          <Popover
            innerRef={popupRef}
            role="dialog"
            ariaLabel={TRIGGER_LABEL}
            className={cn(popupClassName, 'flex flex-col bg-subtle')}
            style={popupStyle}
          >
            <header className="flex items-center gap-2 px-3 py-2">
              <span className="text-xs font-semibold text-foreground">{TRIGGER_LABEL}</span>
            </header>
            <Divider />
            <div className="flex flex-col gap-3 px-3 py-3">
              <SegmentedTabs
                fill
                size="sm"
                ariaLabel="Issue type"
                options={ISSUE_TYPE_OPTIONS}
                value={draft.issueType}
                onChange={(issueType: IssueTypeValue) => setBugReportDraft({ issueType })}
              />
              <Textarea
                autoGrow
                minRows={4}
                maxRows={10}
                aria-label="Description"
                value={draft.description}
                onChange={(e) => setBugReportDraft({ description: e.target.value })}
                placeholder="What happened, and what you expected instead"
              />
              <p className="text-2xs leading-relaxed text-muted-foreground">
                Kept as a draft until you send it from the report form.
              </p>
            </div>
            <Divider />
            <footer className="flex items-center justify-end gap-2 px-3 py-2">
              <Button variant="ghost" size="sm" onClick={clearBugReportDraft} disabled={!hasDraft}>
                Reset
              </Button>
              <Button size="sm" onClick={openFullForm}>
                Add details and send
              </Button>
            </footer>
          </Popover>
        )}
      </DropdownPortal>
    </div>
  );
};
