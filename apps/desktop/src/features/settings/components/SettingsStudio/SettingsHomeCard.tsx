import type { Ref } from 'react';
import { FOCUS_RING, cn, tintClasses } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { SettingsPage } from './settingsDirectory';
import { SettingsPageIcon } from './SettingsPageIcon';

type Props = {
  readonly page: SettingsPage;
  readonly isLastOpened: boolean;
  readonly buttonRef?: Ref<HTMLButtonElement>;
  readonly onOpen: (page: SettingsPage) => void;
};

export const SettingsHomeCard = ({ page, isLastOpened, buttonRef, onOpen }: Props) => {
  const tint = tintClasses(page.tone);
  return (
    <button
      ref={buttonRef}
      type="button"
      data-settings-page={page.key}
      onClick={() => onOpen(page)}
      className={cn(
        'flex w-full min-w-0 items-center gap-2.5 rounded-lg border border-border-soft bg-subtle px-3 py-2.5 text-left motion-safe:transition-colors hover:border-border hover:bg-elevated',
        FOCUS_RING,
      )}
    >
      <span
        aria-hidden
        data-settings-tile=""
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-md',
          tint.bg,
          tint.icon,
        )}
      >
        <SettingsPageIcon glyph={page.glyph} size={ICON_SIZE.control} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          data-settings-label=""
          className={cn('truncate text-row', page.isDanger ? 'text-danger' : 'text-foreground')}
        >
          {page.label}
        </span>
        <span
          data-settings-status=""
          className={cn(
            'truncate text-secondary',
            page.attention === null
              ? 'text-faint-foreground'
              : tintClasses(page.attention.tone).text,
          )}
        >
          {page.attention?.text ?? page.quiet}
        </span>
      </span>
      {isLastOpened ? (
        <span
          data-settings-last=""
          className="shrink-0 rounded-sm bg-fill px-1.5 text-secondary text-muted-foreground"
        >
          Last opened
        </span>
      ) : null}
    </button>
  );
};
