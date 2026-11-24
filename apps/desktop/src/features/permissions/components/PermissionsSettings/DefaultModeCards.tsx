import { CHECK_STATE } from '../../../../store/slices/notifications/errorRecovery';
import { useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { cn, ICON_SIZE, tintClasses } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import {
  DEFAULT_PERMISSION_MODE,
  MODE_COPY,
  PICKER_MODES,
  pickerModeOf,
  type PickerMode,
} from '../../modeCopy';

type Props = {
  readonly workspaceId: WorkspaceId;
};

type SaveParams = {
  readonly mode: PickerMode;
};

export const DefaultModeCards = ({ workspaceId }: Props) => {
  const defaultMode = useAppStore(
    (s) =>
      s.workspaces.find((workspace) => workspace.id === workspaceId)?.defaultPermissionMode ??
      DEFAULT_PERMISSION_MODE,
  );
  const setWorkspacePermissionDefault = useAppStore((s) => s.setWorkspacePermissionDefault);
  const reportError = useAppStore((s) => s.reportError);
  const [isBusy, setIsBusy] = useState(false);
  const value = pickerModeOf({ mode: defaultMode });

  const save = async ({ mode }: SaveParams) => {
    setIsBusy(true);
    try {
      await setWorkspacePermissionDefault({ workspaceId, mode });
    } catch (error) {
      void reportError({
        recovery: CHECK_STATE,
        title: "Couldn't change the default mode",
        error,
        workspaceId,
      });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        role="radiogroup"
        aria-label="Default for new sessions"
        className="grid grid-cols-2 gap-2 @3xl:grid-cols-4"
      >
        {PICKER_MODES.map((mode) => {
          const copy = MODE_COPY[mode];
          const Icon = copy.icon;
          const isSelected = value === mode;
          return (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={isBusy}
              onClick={() => void save({ mode })}
              className={cn(
                'flex min-w-0 flex-col items-start gap-1 rounded-lg border bg-subtle px-3 py-3 text-left motion-safe:transition-colors hover:bg-hover',
                isSelected ? 'border-primary' : 'border-border-soft',
              )}
            >
              <span className="flex w-full items-center gap-2">
                <Icon
                  size={ICON_SIZE.control}
                  aria-hidden
                  className={tintClasses(copy.tone).icon}
                />
                <span className="text-meta text-foreground">{copy.label}</span>
                {mode === DEFAULT_PERMISSION_MODE ? (
                  <span className="rounded-sm bg-muted px-1 text-chip text-muted-foreground">
                    Default
                  </span>
                ) : null}
              </span>
              <span className="text-meta text-muted-foreground">{copy.short}</span>
            </button>
          );
        })}
      </div>
      <p className="text-meta text-muted-foreground">
        Changing this affects new sessions only. A running session keeps its mode; change it from
        the composer.
      </p>
    </div>
  );
};
