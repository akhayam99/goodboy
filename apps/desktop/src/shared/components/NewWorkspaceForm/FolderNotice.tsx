import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { ICON_SIZE, cn, tintClasses } from '@goodboy/ui';

type FolderNoticeTone = 'info' | 'warning' | 'danger' | 'success';

type Props = {
  readonly tone: FolderNoticeTone;
  readonly title: ReactNode;
  readonly body?: ReactNode;
  readonly actions?: ReactNode;
};

const TONE_ICON = {
  info: Info,
  warning: TriangleAlert,
  danger: CircleAlert,
  success: CircleCheck,
} as const satisfies Record<FolderNoticeTone, unknown>;

export const FolderNotice = ({ tone, title, body, actions }: Props) => {
  const Icon = TONE_ICON[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      data-tone={tone}
      className="flex items-start gap-2 rounded-lg bg-muted p-3 text-meta text-muted-foreground motion-safe:animate-fade-in"
    >
      <span className="flex h-4 shrink-0 items-center">
        <Icon size={ICON_SIZE.control} aria-hidden className={cn(tintClasses(tone).icon)} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="break-words">
          <span className="text-foreground">{title}</span>
          {body === undefined ? null : <> {body}</>}
        </p>
        {actions === undefined ? null : (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
};
