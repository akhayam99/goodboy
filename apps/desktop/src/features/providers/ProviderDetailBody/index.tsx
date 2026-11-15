import { isApiProvider } from '@goodboy/core/providers';
import type { WorkspaceId } from '@goodboy/types';
import { Button, EmptyState, PaneShell, RefreshIconButton, StateBadge } from '@goodboy/ui';
import type { FramePage } from '@goodboy/ui';
import type { ProviderDisplayInfo } from '../providers';
import { useAppStore } from '../../../store';
import { ProviderMenu } from '../../actions/ProviderMenu';
import { useProviderTarget } from '../hooks/useProviderTarget';
import { ProviderConnect } from '../components/ProviderConnect';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import { AccountGroup } from '../components/ProviderStudio/ProviderPage/AccountGroup';
import { CliGroup } from '../components/ProviderStudio/ProviderPage/AccountGroup/CliGroup';
import { ModelsGroup } from '../components/ProviderStudio/ProviderPage/ModelsGroup';
import { ProviderAttentionNotice } from '../components/ProviderStudio/ProviderPage/ProviderAttentionNotice';
import { ProviderHealthNotice } from '../components/ProviderStudio/ProviderPage/ProviderHealthNotice';
import { UsageGroup } from '../components/ProviderStudio/ProviderPage/UsageGroup';
import { usePlanLabel } from '../components/ProviderStudio/ProviderPage/usePlanLabel';
import { PermissionsFold } from './PermissionsFold';
import { ProviderFacts } from './ProviderFacts';
import { ProviderTitle } from './ProviderTitle';
import { useProviderStateWord } from './useProviderStateWord';

type Props = {
  readonly info: ProviderDisplayInfo;
  readonly shouldAutoConnect: boolean;
  readonly shouldAutoUpdate: boolean;
  readonly isModelsFocused: boolean;
  readonly workspaceId: WorkspaceId | null;
  readonly page?: FramePage;
  readonly animationClassName?: string;
};

export const ProviderDetailBody = ({
  info,
  shouldAutoConnect,
  shouldAutoUpdate,
  isModelsFocused,
  workspaceId,
  page,
  animationClassName,
}: Props) => {
  const id = info.id;
  const connectPhase = useAppStore((s) => s.providerConnect[id]?.phase ?? 'idle');
  const planLabel = usePlanLabel({ providerId: id });
  const isApi = isApiProvider({ id });

  const isSettled =
    connectPhase === 'idle' || connectPhase === 'cancelled' || connectPhase === 'success';
  const isCheckable = info.connection === 'connected' || info.connection === 'cannot_check';
  const isReady = isApi
    ? info.connection !== 'missing' && info.connection !== 'error' && info.connection !== 'unknown'
    : isCheckable && isSettled;
  const hasDetectionError = !isApi && info.connection === 'error' && isSettled;
  const hasDetectedCli =
    !isApi &&
    (isCheckable ||
      info.connection === 'installed_disconnected' ||
      (info.connection === 'error' && info.version !== null));
  const { target, isChecking, isHistoryOpen, refresh, closeHistory } = useProviderTarget({
    info,
    isReady,
  });
  const stateWord = useProviderStateWord({ info, isReady });
  const onRefresh = () => void refresh();

  return (
    <PaneShell
      scroll="body"
      {...(page !== undefined && { page })}
      {...(animationClassName !== undefined && { animationClassName })}
      title={<ProviderTitle providerId={id} label={info.label} />}
      badge={<StateBadge tone={stateWord.tone}>{stateWord.word}</StateBadge>}
      actions={
        <>
          <RefreshIconButton
            label={`Check ${info.label} again`}
            isLoading={isChecking}
            onClick={onRefresh}
          />
          <ProviderMenu target={target} />
        </>
      }
      subheader={<ProviderFacts info={info} planLabel={planLabel} isReady={isReady} />}
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
          autoStart={shouldAutoConnect}
          onDone={onRefresh}
        />
      ) : null}
      {hasDetectedCli && !isReady ? <CliGroup info={info} autoUpdate={shouldAutoUpdate} /> : null}
      {isReady ? (
        <UsageGroup providerId={id} billing={isApi ? 'token' : 'plan'} planLabel={planLabel} />
      ) : null}
      {isReady ? (
        <ModelsGroup providerId={id} workspaceId={workspaceId} isFocused={isModelsFocused} />
      ) : null}
      {isReady || isApi ? (
        <AccountGroup
          info={info}
          planLabel={planLabel}
          autoUpdate={shouldAutoUpdate}
          target={target}
          isHistoryOpen={isHistoryOpen}
          onCloseHistory={closeHistory}
        />
      ) : null}
      {isReady ? <PermissionsFold providerId={id} /> : null}
    </PaneShell>
  );
};
