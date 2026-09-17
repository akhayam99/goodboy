import { Eye, Pencil, RotateCcw } from 'lucide-react';
import { IconButton } from '@goodboy/ui';
import type { ReportRegenerateHandle } from '../../useReportRegenerate';

export type ReportMode = 'preview' | 'edit';

type Props = {
  readonly mode: ReportMode;
  readonly regenerate: ReportRegenerateHandle;
  readonly onModeChange: (next: ReportMode) => void;
};

export const ReportBandActions = ({ mode, regenerate, onModeChange }: Props) => (
  <span data-testid="report-band-actions" className="flex shrink-0 items-center gap-1">
    <IconButton
      variant="ghost"
      icon={Eye}
      label="Preview"
      tooltip="Read the report"
      aria-pressed={mode === 'preview'}
      data-testid="report-preview"
      onClick={() => onModeChange('preview')}
    />
    <IconButton
      variant="ghost"
      icon={Pencil}
      label="Edit"
      tooltip="Edit the report source"
      aria-pressed={mode === 'edit'}
      data-testid="report-edit"
      onClick={() => onModeChange('edit')}
    />
    <IconButton
      variant="ghost"
      icon={RotateCcw}
      label={regenerate.isRegenerating ? 'Starting' : 'Regenerate'}
      tooltip={regenerate.hint}
      disabled={regenerate.isRegenerating || !regenerate.canRegenerate}
      busy={regenerate.isRegenerating}
      data-testid="report-regenerate"
      onClick={regenerate.regenerate}
    />
  </span>
);
