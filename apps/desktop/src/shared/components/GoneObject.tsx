import { ArrowLeft, type LucideIcon } from 'lucide-react';
import { Button, EmptyState, ICON_SIZE } from '@goodboy/ui';

type Props = {
  readonly noun: string;
  readonly icon: LucideIcon;
  readonly onBack?: () => void;
};

export const GoneObject = ({ noun, icon, onBack }: Props) => (
  <EmptyState
    size="section"
    icon={icon}
    title={`This ${noun} is no longer in this session`}
    description="It was deleted or moved."
    {...(onBack !== undefined && {
      action: (
        <Button size="sm" variant="ghost" onClick={onBack}>
          <ArrowLeft size={ICON_SIZE.control} aria-hidden />
          Back
        </Button>
      ),
    })}
  />
);
