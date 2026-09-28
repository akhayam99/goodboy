import type { ReactNode } from 'react';
import { Eye, Layers } from 'lucide-react';
import type { ProviderId } from '@goodboy/types';
import { ProviderGlyph } from '../../../../shared/components/RoutingPicker/ProviderGlyph';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { pluralize } from '../../../../shared/utils/pluralize';
import { ChatHeaderChip } from './ChatHeaderChip';

type Props = {
  readonly title: string;
  readonly workspaceName: string;
  readonly projectCount: number;
  readonly provider: ProviderId;
  readonly modelLabel: string;
  readonly action?: ReactNode;
};

export const ChatHeader = ({
  title,
  workspaceName,
  projectCount,
  provider,
  modelLabel,
  action = null,
}: Props) => (
  <header className="flex min-w-0 shrink-0 items-center gap-2 px-6 pb-2.5 pt-3">
    <h2 className="min-w-0 truncate text-heading text-foreground">{title}</h2>
    <div className="hidden shrink-0 items-center gap-1.5 @3xl/chat:flex">
      <ChatHeaderChip
        icon={<Layers size={ICON_SIZE.row} aria-hidden className="text-faint-foreground" />}
        label={`${workspaceName} · ${pluralize(projectCount, 'project')}`}
      />
      <ChatHeaderChip
        icon={<Eye size={ICON_SIZE.row} aria-hidden className="text-faint-foreground" />}
        label="Read-only"
      />
      <ChatHeaderChip
        icon={<ProviderGlyph id={provider} size={ICON_SIZE.row} />}
        label={modelLabel}
      />
    </div>
    <span className="flex-1" />
    {action}
  </header>
);
