import { useCallback, useState } from 'react';
import { PROVIDER_CONNECT_CAPABILITIES, isApiProvider } from '@goodboy/core';
import type { WorkspaceId } from '@goodboy/types';
import { Button, EmptyState, OverflowMenu, type OverflowMenuItem, PaneShell } from '@goodboy/ui';
import type { ProviderDisplayInfo } from '../../../providers';
import { useAppStore } from '../../../../../store';
import { useCopyText } from '../../../../../shared/hooks/useCopyText';
import { useNow } from '../../../../../shared/hooks/useNow';
import { useProviderHealth } from '../../../hooks/useProviderHealth';
import { confirmationLine } from '../../../providerHealthCopy';
import { ProviderConnect } from '../../ProviderConnect';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { SETTINGS_PANE_ENTRY } from '../../../../settings/components/SettingsStudio/settingsPaneEntry';
import { AccountGroup, type AccountConfirm } from './AccountGroup';
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
  readonly confirmation: string | null;
};

const CLOCK_MS = 60_000;

const kindLine = ({ planLabel, isApi }: Pick<MetaParams, 'planLabel' | 'isApi'>): string | null => {
  if (isApi) {
    return 'Runs through the OpenCode runtime';
  }
  return planLabel === null ? null : `${planLabel} plan`;
};

const metaLine = ({
  planLabel,
  isApi,
  scopeLabel,
  confirmation,
}: MetaParams): string | undefined => {
  const parts = [scopeLabel, kindLine({ planLabel, isApi }), confirmation].filter(
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
  const connectProvider = useAppStore((s) => s.connectProvider);
  const logoutProvider = useAppStore((s) => s.logoutProvider);
  const refreshProviders = useAppStore((s) => s.refreshProviders);
  const identity = useAppStore((s) => s.authResults?.[id]?.identity ?? info.identity);
  const health = useProviderHealth({ providerId: id });
  const nowMs = useNow(CLOCK_MS);
  const copyText = useCopyText();
  const planLabel = usePlanLabel({ providerId: id });
  const isApi = isApiProvider({ id });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [confirm, setConfirm] = useState<AccountConfirm>('none');

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshProviders({ isFresh: true });
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshProviders]);

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
  const canReauth = !isApi && PROVIDER_CONNECT_CAPABILITIES[id].tier !== 'manual';
  const reauth = () => {
    if (PROVIDER_CONNECT_CAPABILITIES[id].reauthSignsOut) {
      setConfirm('reauth');
      return;
    }
    void connectProvider(id);
  };

  const menuItems: ReadonlyArray<OverflowMenuItem> = [
    {
      kind: 'item',
      key: 'check',
      label: 'Check again',
      disabled: isRefreshing,
      onClick: () => void onRefresh(),
    },
    ...(isReady && canReauth
      ? [{ kind: 'item' as const, key: 'reauth', label: 'Sign in again', onClick: reauth }]
      : []),
    ...(isReady && !isApi
      ? [
          {
            kind: 'item' as const,
            key: 'signout',
            label: 'Sign out',
            destructive: true,
            onClick: () => setConfirm('disconnect'),
          },
        ]
      : []),
    {
      kind: 'item',
      key: 'copy',
      label: 'Copy CLI path',
      onClick: () => void copyText({ text: info.binary }),
    },
  ];

  return (
    <PaneShell
      scroll="body"
      animationClassName={SETTINGS_PANE_ENTRY}
      title={info.label}
      meta={metaLine({
        planLabel,
        isApi,
        scopeLabel,
        confirmation: isApi ? null : confirmationLine({ providerId: id, health, nowMs, identity }),
      })}
      actions={<OverflowMenu items={menuItems} label={`More ${info.label} actions`} />}
    >
      <ProviderHealthNotice
        info={info}
        isChecking={isRefreshing}
        onCheckAgain={() => void onRefresh()}
        {...(canReauth && { onSignIn: reauth })}
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
            <Button size="sm" onClick={() => void onRefresh()} disabled={isRefreshing}>
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
          onDone={() => void onRefresh()}
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
            canReauth={canReauth}
            autoUpdate={autoUpdate}
            confirm={confirm}
            onConfirmChange={setConfirm}
            onReauth={reauth}
            onConfirmReauth={() => void connectProvider(id)}
            onDisconnect={() => void logoutProvider(id)}
          />
        </>
      ) : null}
    </PaneShell>
  );
};
