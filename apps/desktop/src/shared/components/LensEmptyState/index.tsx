import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { EmptyState, type Tone } from '@goodboy/ui';

type Props = {
  readonly icon: LucideIcon;
  readonly tone: Tone;
  readonly title: string;
  readonly description: string;
  readonly action?: ReactNode;
  readonly className?: string;
};

export const LensEmptyState = ({ icon, tone, title, description, action, className }: Props) => (
  <EmptyState
    bordered
    size="inline"
    icon={icon}
    tone={tone}
    title={title}
    description={description}
    action={action}
    className={className}
  />
);
