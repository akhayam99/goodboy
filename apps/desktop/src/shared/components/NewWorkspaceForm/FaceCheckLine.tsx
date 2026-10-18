import { Check } from 'lucide-react';
import { ICON_SIZE, tintClasses } from '@goodboy/ui';

type Props = {
  readonly children: string;
};

export const FaceCheckLine = ({ children }: Props) => (
  <li className="flex items-start gap-2">
    <span className="flex h-5 shrink-0 items-center">
      <Check size={ICON_SIZE.row} aria-hidden className={tintClasses('primary').icon} />
    </span>
    <span className="min-w-0">{children}</span>
  </li>
);
