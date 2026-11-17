import { IconButton, ShellRailItem, type ShellRailMark } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { openReportSheet } from '../../../features/bug-report/openReportSheet';
import { useHasBugReportDraft } from '../../../features/bug-report/hooks/useHasBugReportDraft';

type Props = {
  readonly variant?: 'column' | 'rail';
};

const BugIcon = CONCEPT_ICONS.reportIssue;

const DRAFT_MARK: ShellRailMark = { kind: 'dot', name: 'draft saved' };

export const ReportBugButton = ({ variant = 'column' }: Props) => {
  const hasDraft = useHasBugReportDraft();
  if (variant === 'rail') {
    return (
      <ShellRailItem
        id="report"
        icon={BugIcon}
        label="Report a bug"
        word="Report"
        shortcut="report.open"
        mark={hasDraft ? DRAFT_MARK : null}
        onSelect={() => openReportSheet()}
      />
    );
  }
  return (
    <IconButton
      icon={BugIcon}
      label={hasDraft ? 'Report a bug, draft saved' : 'Report a bug'}
      shortcut="report.open"
      tooltipSide="top"
      size="xs"
      onClick={() => openReportSheet()}
      data-report-bug=""
    />
  );
};
