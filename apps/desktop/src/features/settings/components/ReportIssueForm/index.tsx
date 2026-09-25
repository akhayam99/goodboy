import { Button, Divider, SegmentedTabs, Textarea } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { ISSUE_TYPE_OPTIONS, type IssueTypeValue } from '../../reportIssueTypes';
import { REPORT_ISSUE_STUDIO_EVENT } from '../../reportIssueStudioEvent';
import { useBugReportImages } from '../../hooks/useBugReportImages';
import { useHasBugReportDraft } from '../../hooks/useHasBugReportDraft';
import { BugReportImages } from '../BugReportImages';

type Props = {
  readonly onOpenFullForm: () => void;
};

export const ReportIssueForm = ({ onOpenFullForm }: Props) => {
  const draft = useAppStore((s) => s.bugReportDraft);
  const setBugReportDraft = useAppStore((s) => s.setBugReportDraft);
  const clearBugReportDraft = useAppStore((s) => s.clearBugReportDraft);
  const imageControl = useBugReportImages();
  const hasDraft = useHasBugReportDraft();

  const openFullForm = () => {
    onOpenFullForm();
    window.dispatchEvent(new CustomEvent(REPORT_ISSUE_STUDIO_EVENT));
  };

  return (
    <div className="flex flex-col">
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
    </div>
  );
};
