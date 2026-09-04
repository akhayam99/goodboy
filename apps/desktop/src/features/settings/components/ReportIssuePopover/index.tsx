import {
  AnchoredPopover,
  Button,
  cn,
  Divider,
  SegmentedTabs,
  Textarea,
  Tooltip,
  useDropdown,
} from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import { emptyBugReportDraft } from '../../../../store/slices/bugReportDraft/state';
import { ISSUE_TYPE_OPTIONS, type IssueTypeValue } from '../../reportIssueTypes';
import { REPORT_ISSUE_STUDIO_EVENT } from '../../reportIssueStudioEvent';
import { useBugReportImages } from '../../hooks/useBugReportImages';
import { BugReportImages } from '../BugReportImages';

const TRIGGER_LABEL = 'Report an issue';
const DRAFT_TRIGGER_LABEL = 'Report an issue, draft saved';

export const ReportIssuePopover = () => {
  const dropdown = useDropdown({
    align: 'end',
    expectedHeight: 340,
    expectedWidth: 384,
    width: 'w-96 max-w-[calc(100vw-2rem)]',
  });
  const { open, close, toggle } = dropdown;
  const draft = useAppStore((s) => s.bugReportDraft);
  const setBugReportDraft = useAppStore((s) => s.setBugReportDraft);
  const clearBugReportDraft = useAppStore((s) => s.clearBugReportDraft);
  const imageControl = useBugReportImages();

  const hasDraft =
    draft.title !== '' ||
    draft.description !== '' ||
    draft.issueType !== emptyBugReportDraft.issueType ||
    draft.images.length > 0;
  const triggerLabel = hasDraft ? DRAFT_TRIGGER_LABEL : TRIGGER_LABEL;
  const ReportIssueIcon = CONCEPT_ICONS.reportIssue;

  const openFullForm = () => {
    close();
    window.dispatchEvent(new CustomEvent(REPORT_ISSUE_STUDIO_EVENT));
  };

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={TRIGGER_LABEL}
      className="flex flex-col bg-subtle"
      trigger={
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
            <ReportIssueIcon size={ICON_SIZE.control} aria-hidden />
            {hasDraft && (
              <span
                data-testid="report-issue-draft-dot"
                aria-hidden
                className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-info"
              />
            )}
          </button>
        </Tooltip>
      }
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
          onPaste={imageControl.onPaste}
          placeholder="What happened, and what you expected instead"
        />
        <BugReportImages control={imageControl} />
        <p className="text-2xs leading-relaxed text-muted-foreground">
          Kept as a draft until you send it.
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
    </AnchoredPopover>
  );
};
