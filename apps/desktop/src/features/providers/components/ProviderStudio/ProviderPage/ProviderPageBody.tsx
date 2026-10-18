import { isApiProvider } from '@goodboy/core';
import type { WorkspaceId } from '@goodboy/types';
import { Button, EmptyState, PaneShell } from '@goodboy/ui';
import type { ProviderDisplayInfo } from '../../../providers';
import { useAppStore } from '../../../../../store';
import { ProviderMenu } from '../../../../actions/ProviderMenu';
import { useProviderTarget } from '../../../hooks/useProviderTarget';
import { ProviderConnect } from '../../ProviderConnect';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { SETTINGS_PANE_ENTRY } from '../../../../settings/components/SettingsStudio/settingsPaneEntry';
import { AccountGroup } from './AccountGroup';
import { CliGroup } from './AccountGroup/CliGroup';
import { ModelsGroup } from './ModelsGroup';
import { PermissionsGroup } from './PermissionsGroup';
import { ProviderAttentionNotice } from './ProviderAttentionNotice';
import { ProviderHealthNotice } from './ProviderHealthNotice';
import { UsageGroup } from './UsageGroup';
import { usePlanLabel } from './usePlanLabel';

type Props = {
  readonly info: ProviderDisplayInfo;
  readonly autoConnect: boolean;
  readonly autoUpdate: boolean;
  readonly focusModels: boolean;
  readonly workspaceId: WorkspaceId | null;
  readonly scopeLabel: string | null;
};

type MetaParams = {
  readonly planLabel: string | null;
  readonly isApi: boolean;
  readonly scopeLabel: string | null;
};

const kindLine = ({ planLabel, isApi }: Pick<MetaParams, 'planLabel' | 'isApi'>): string | null => {
  if (isApi) {
    return 'Runs through the OpenCode runtime';
  }
  return planLabel === null ? null : `${planLabel} plan`;
};

const metaLine = ({ planLabel, isApi, scopeLabel }: MetaParams): string | undefined => {
  const parts = [scopeLabel, kindLine({ planLabel, isApi })].filter(
    (part): part is string => part !== null,
  );
  return parts.length === 0 ? undefined : parts.join(' · ');
};

export const ProviderPageBody = ({
  info,
  autoConnect,
  autoUpdate,
  focusModels,
  workspaceId,
  scopeLabel,
}: Props) => {
  const id = info.id;
  const connectPhase = useAppStore((s) => s.providerConnect[id]?.phase ?? 'idle');
  const planLabel = usePlanLabel({ providerId: id });
  const isApi = isApiProvider({ id });

  const settled =
    connectPhase === 'idle' || connectPhase === 'cancelled' || connectPhase === 'success';
  const isCheckable = info.connection === 'connected' || info.connection === 'cannot_check';
  const isReady = isApi
    ? info.connection !== 'missing' && info.connection !== 'error' && info.connection !== 'unknown'
    : isCheckable && settled;
  const hasDetectionError = !isApi && info.connection === 'error' && settled;
  const hasDetectedCli =
    !isApi &&
    (isCheckable ||
      info.connection === 'installed_disconnected' ||
      (info.connection === 'error' && info.version !== null));
  const { target, isChecking, isHistoryOpen, refresh, closeHistory } = useProviderTarget({
    info,
    isReady,
  });
  const onRefresh = () => void refresh();

  return (
    <PaneShell
      scroll="body"
      animationClassName={SETTINGS_PANE_ENTRY}
      title={info.label}
      meta={metaLine({ planLabel, isApi, scopeLabel })}
      actions={<ProviderMenu target={target} />}
    >
      <ProviderHealthNotice
        info={info}
        isChecking={isChecking}
        onCheckAgain={onRefresh}
        target={target}
      />
      {isReady && !isApi ? <ProviderAttentionNotice providerId={id} /> : null}
      {hasDetectionError ? (
        <EmptyState
          bordered
          tone={CONCEPT_TONE.providers}
          icon={CONCEPT_ICONS.providers}
          title="Detection failed"
          description={info.error ?? `Goodboy couldn't detect the ${info.label} CLI.`}
          action={
            <Button size="sm" onClick={onRefresh} disabled={isChecking}>
              Retry
            </Button>
          }
        />
      ) : null}
      {!isApi && !isReady && !hasDetectionError ? (
        <ProviderConnect
          providerId={id}
          chrome="studio"
          autoStart={autoConnect}
          onDone={onRefresh}
        />
      ) : null}
      {hasDetectedCli && !isReady ? <CliGroup info={info} autoUpdate={autoUpdate} /> : null}
      {isReady || isApi ? (
        <>
          {isReady ? (
            <UsageGroup providerId={id} billing={isApi ? 'token' : 'plan'} planLabel={planLabel} />
          ) : null}
          {isReady ? (
            <ModelsGroup providerId={id} workspaceId={workspaceId} isFocused={focusModels} />
          ) : null}
          {isReady ? <PermissionsGroup providerId={id} /> : null}
          <AccountGroup
            info={info}
            planLabel={planLabel}
            autoUpdate={autoUpdate}
            target={target}
            isHistoryOpen={isHistoryOpen}
            onCloseHistory={closeHistory}
          />
        </>
      ) : null}
    </PaneShell>
  );
};
