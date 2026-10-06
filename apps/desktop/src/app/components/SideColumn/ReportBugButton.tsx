import { Tooltip, cn } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../shared/keyboard/registry';
import { openReportSheet } from '../../../features/bug-report/openReportSheet';

type Props = {
  readonly variant?: 'column' | 'rail';
};

const BugIcon = CONCEPT_ICONS.reportIssue;

export const ReportBugButton = ({ variant = 'column' }: Props) => (
  <Tooltip
    content={`Report a bug  ${shortcutGlyphs('report.open')}`}
    side={variant === 'rail' ? 'right' : 'top'}
  >
    <button
      type="button"
      onClick={() => openReportSheet()}
      aria-label="Report a bug"
      data-report-bug=""
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md text-muted-foreground motion-safe:transition-colors',
        'hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        variant === 'rail' ? 'size-8' : 'size-7',
      )}
    >
      <BugIcon size={ICON_SIZE.control} aria-hidden />
    </button>
  </Tooltip>
);
