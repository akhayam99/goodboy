import type { ReactNode } from 'react';
import { FormActions } from '@goodboy/ui';
import { FormSection } from '../../../../shared/components/FormSection';
import { START_KIND_COPY } from '../../startKind/startKindCopy';
import { StartFailure } from './StartFailure';
import { StartSettingsRow } from './StartSettingsRow';
import type { StartSettingItem } from './startSettingsOf';

type Props = {
  readonly plan: ReactNode;
  readonly hint: string | null;
  readonly isRouteHint?: boolean;
  readonly isSectioned?: boolean;
  readonly settings: ReadonlyArray<StartSettingItem>;
  readonly runsOn?: ReactNode;
  readonly note: string | null;
  readonly error: string | null;
  readonly reason: string | null;
  readonly reasonId: string;
  readonly children: ReactNode;
};

export const StartForm = ({
  plan,
  hint,
  isRouteHint = false,
  isSectioned = false,
  settings,
  runsOn = null,
  note,
  error,
  reason,
  reasonId,
  children,
}: Props) => {
  const hasPlan = plan != null;
  const hintLine =
    hint === null ? null : (
      <p
        className="text-meta text-muted-foreground"
        {...(isRouteHint && { 'data-run-route-line': '' })}
      >
        {hint}
      </p>
    );
  const actionRow = (
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
  );
  if (isSectioned) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        {hasPlan ? <FormSection label={START_KIND_COPY.plan.label}>{plan}</FormSection> : null}
        {settings.length === 0 ? null : (
          <FormSection label={START_KIND_COPY.sections.rules}>
            <StartSettingsRow items={settings} />
          </FormSection>
        )}
        {runsOn == null ? null : (
          <FormSection label={START_KIND_COPY.sections.model}>{runsOn}</FormSection>
        )}
        {hintLine === null ? null : (
          <FormSection label={START_KIND_COPY.sections.scope}>{hintLine}</FormSection>
        )}
        {error === null ? null : <StartFailure error={error} />}
        {actionRow}
      </div>
    );
  }
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {!hasPlan && settings.length === 0 ? null : (
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-3">
          {plan}
          <StartSettingsRow items={settings} className={hasPlan ? 'col-start-2' : 'col-span-2'} />
        </div>
      )}
      {runsOn}
      {hintLine}
      {error === null ? null : <StartFailure error={error} />}
      {actionRow}
    </div>
  );
};
