import { IconButton } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { openReportSheet } from '../../../features/bug-report/openReportSheet';

type Props = {
  readonly variant?: 'column' | 'rail';
};

const BugIcon = CONCEPT_ICONS.reportIssue;

export const ReportBugButton = ({ variant = 'column' }: Props) => (
  <IconButton
    icon={BugIcon}
    label="Report a bug"
    shortcut="report.open"
    tooltipSide={variant === 'rail' ? 'right' : 'top'}
    size="sm"
    onClick={() => openReportSheet()}
    data-report-bug=""
  />
);
