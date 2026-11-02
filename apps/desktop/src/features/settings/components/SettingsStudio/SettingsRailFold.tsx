import { useId } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn, Eyebrow, ICON_SIZE, Reveal, ROW_INTERACTIVE, StatusDot } from '@goodboy/ui';

import type { SettingsScopeChange } from '../../settingsFocus';
import { foldAttentionLinesOf, foldAttentionOf, type SettingsGroup } from './settingsDirectory';
import { SettingsRailPageList } from './SettingsRailPageList';

type Props = {
  readonly group: SettingsGroup;
  readonly isOpen: boolean;
  readonly pageKey: string | null;
  readonly onToggle: () => void;
  readonly onSelect: (params: SettingsScopeChange) => void;
};

export const SettingsRailFold = ({ group, isOpen, pageKey, onToggle, onSelect }: Props) => {
  const listId = useId();
  const worst = foldAttentionOf({ group });
  return (
    <div data-settings-group={group.scope} className="flex flex-col gap-1">
      <h2>
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={listId}
          onClick={onToggle}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-faint-foreground',
            ROW_INTERACTIVE,
          )}
        >
          <ChevronRight
            size={ICON_SIZE.row}
            aria-hidden
            className={cn('shrink-0 motion-safe:transition-transform', isOpen && 'rotate-90')}
          />
          <span className="min-w-0 flex-1 truncate">
            <Eyebrow muted label={group.label} />
          </span>
          {isOpen || worst === null ? null : (
            <StatusDot
              tone={worst.tone}
              size="sm"
              ariaLabel={worst.text}
              title={foldAttentionLinesOf({ group })}
            />
          )}
        </button>
      </h2>
      <Reveal open={isOpen}>
        <SettingsRailPageList id={listId} group={group} pageKey={pageKey} onSelect={onSelect} />
      </Reveal>
    </div>
  );
};
