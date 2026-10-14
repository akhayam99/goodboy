import { Check } from 'lucide-react';
import { StatusDot } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../../shared/components/conceptIcons';
import type { CiFixStageStatus } from '../../../../../branch/checks/ciFixStages';

type Props = {
  readonly status: CiFixStageStatus;
};

export const CiFixStageGlyph = ({ status }: Props) => {
  switch (status) {
    case 'done':
      return <Check size={ICON_SIZE.mark} aria-hidden className="shrink-0 text-success" />;
    case 'run':
      return <StatusDot tone="info" size="sm" pulsing />;
    case 'need':
      return <StatusDot tone="warning" size="sm" />;
    case 'failed':
      return <StatusDot tone="danger" size="sm" />;
    case 'wait':
      return <StatusDot tone="neutral" size="sm" className="opacity-50" />;
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
};
