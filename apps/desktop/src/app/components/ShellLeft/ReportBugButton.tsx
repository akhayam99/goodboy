import { ShellRailItem, type ShellRailMark } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { openReportSheet } from '../../../features/bug-report/openReportSheet';
import { useHasBugReportDraft } from '../../../features/bug-report/hooks/useHasBugReportDraft';

const DRAFT_MARK: ShellRailMark = { kind: 'dot', name: 'draft saved' };

export const ReportBugButton = () => {
  const hasDraft = useHasBugReportDraft();
  return (
    <ShellRailItem
      id="report"
      icon={CONCEPT_ICONS.reportIssue}
      label="Report a bug"
      word="Report"
      shortcut="report.open"
      mark={hasDraft ? DRAFT_MARK : null}
      onSelect={() => openReportSheet()}
    />
  );
};
