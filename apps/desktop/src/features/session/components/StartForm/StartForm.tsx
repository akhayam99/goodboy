import type { ReactNode } from 'react';
import { FormActions } from '@goodboy/ui';
import type { StartFormKind } from './startFormKinds';
import { StartFailure } from './StartFailure';
import { StartHowChip } from './StartHowChip';
import { StartSettingsRow } from './StartSettingsRow';
import type { StartSettingItem } from './startSettingsOf';

type Props = {
  readonly kind: StartFormKind | null;
  readonly hint: string | null;
  readonly isRouteHint?: boolean;
  readonly hasPresets: boolean;
  readonly isDisabled: boolean;
  readonly onKind: ((kind: StartFormKind) => void) | null;
  readonly fields: ReactNode;
  readonly settings: ReadonlyArray<StartSettingItem>;
  readonly note: string | null;
  readonly error: string | null;
  readonly reason: string | null;
  readonly reasonId: string;
  readonly children: ReactNode;
};

export const StartForm = ({
  kind,
  hint,
  isRouteHint = false,
  hasPresets,
  isDisabled,
  onKind,
  fields,
  settings,
  note,
  error,
  reason,
  reasonId,
  children,
}: Props) => (
  <div className="flex min-w-0 flex-col gap-4">
    {fields}
    <StartSettingsRow
      lead={
        onKind === null ? null : (
          <StartHowChip
            kind={kind ?? 'auto'}
            hasPresets={hasPresets}
            isDisabled={isDisabled}
            onPick={onKind}
          />
        )
      }
      items={settings}
    />
    {hint === null ? null : (
      <p
        className="text-meta text-muted-foreground"
        {...(isRouteHint && { 'data-run-route-line': '' })}
      >
        {hint}
      </p>
    )}
    {error === null ? null : <StartFailure error={error} />}
    <FormActions
      leading={
        note === null ? null : (
          <p className="min-w-0 truncate text-meta text-faint-foreground">{note}</p>
        )
      }
      reason={reason}
      reasonId={reasonId}
    >
      {children}
    </FormActions>
  </div>
);
