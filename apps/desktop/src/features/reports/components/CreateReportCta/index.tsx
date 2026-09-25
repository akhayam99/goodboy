import { Button, cn } from '@goodboy/ui';
import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { reportCreationAdapter } from '../../reportCreationAdapter';
import { ReportTile } from './ReportTile';

type CreateReportCtaVariant = 'compact' | 'tile';

type Props = {
  readonly sessionId: SessionId;
  readonly workflowRunId?: WorkflowRunId | null;
  readonly variant?: CreateReportCtaVariant;
  readonly className?: string;
  readonly title?: string;
};

export const CreateReportCta = ({
  sessionId,
  workflowRunId = null,
  variant = 'compact',
  className,
  title,
}: Props) => {
  const openArtifactCreation = useAppStore((state) => state.openArtifactCreation);
  const open = () => openArtifactCreation({ sessionId, kind: 'report', workflowRunId });

  if (variant === 'tile') {
    return <ReportTile sessionId={sessionId} className={className} onOpen={open} />;
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      className={cn('min-w-0', className)}
      data-testid="create-report-cta"
      title={title ?? reportCreationAdapter.ctaTitle}
      onClick={open}
    >
      <CONCEPT_ICONS.report size={ICON_SIZE.row} aria-hidden />
      Create report
    </Button>
  );
};
