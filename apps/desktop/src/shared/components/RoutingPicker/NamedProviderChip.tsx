import type { ProviderId } from '@goodboy/types';
import { cn, tintClasses } from '@goodboy/ui';
import { PROVIDER_LABEL } from '../../../features/providers/providerLabel';
import { useProviderStanding } from '../../../features/providers/hooks/useProviderStanding';
import { ProviderGlyph } from './ProviderGlyph';
import { ICON_SIZE } from '../conceptIcons';

type Props = {
  readonly id: ProviderId;
  readonly isActive: boolean;
  readonly isConnected: boolean;
  readonly onSelect: () => void;
};

export const NamedProviderChip = ({ id, isActive, isConnected, onSelect }: Props) => {
  const standing = useProviderStanding({ provider: id });
  const note = isConnected ? (standing?.text ?? 'Usable') : 'Not connected';
  const isAtLimit = standing?.standing === 'at-limit';
  return (
    <button
      type="button"
      aria-pressed={isActive}
      aria-label={`${PROVIDER_LABEL[id]}, ${note}`}
      onClick={onSelect}
      className={cn(
        'flex min-w-0 flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left transition-colors',
        isActive
          ? cn('border-primary bg-background', tintClasses('primary').bgSoft)
          : 'border-border-soft bg-background hover:border-border hover:bg-hover',
      )}
    >
      <span className="flex min-w-0 items-center gap-2 text-row text-foreground">
        <ProviderGlyph id={id} size={ICON_SIZE.row} />
        <span className="truncate">{PROVIDER_LABEL[id]}</span>
      </span>
      <span
        className={cn(
          'truncate text-meta',
          isAtLimit ? tintClasses('warning').text : 'text-muted-foreground',
        )}
      >
        {note}
      </span>
    </button>
  );
};
