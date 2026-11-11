import { IconButton } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { openReportSheet } from '../../../features/bug-report/openReportSheet';
import { useHasBugReportDraft } from '../../../features/bug-report/hooks/useHasBugReportDraft';

type Props = {
  readonly variant?: 'column' | 'rail';
};

const BugIcon = CONCEPT_ICONS.reportIssue;

export const ReportBugButton = ({ variant = 'column' }: Props) => {
  const hasDraft = useHasBugReportDraft();
  return (
    <IconButton
      icon={BugIcon}
      label={hasDraft ? 'Report a bug, draft saved' : 'Report a bug'}
      shortcut="report.open"
      tooltipSide={variant === 'rail' ? 'right' : 'top'}
      size={variant === 'rail' ? 'sm' : 'xs'}
      onClick={() => openReportSheet()}
      data-report-bug=""
    />
  );
};
