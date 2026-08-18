import { useCallback, useState } from 'react';
import { SectionHeader, Tooltip } from '@goodboy/ui';
import { CircleCheck, RotateCw, Terminal, TriangleAlert } from 'lucide-react';
import type { ProviderInfo } from '../../../../features/providers/providers';
import { useAppStore } from '../../../../store';
import { brandColor, PROVIDER_BRAND } from '../provider-brand';
import { ProviderBindingsSection } from './ProviderBindingsSection';
import { ProviderCredentialsSection } from './ProviderCredentialsSection';
import { StudioPanel } from '../../../../shared/components/StudioPanel';

type Props = {
  readonly info: ProviderInfo;
};

export const ApiProviderDetail = ({ info }: Props) => {
  const Icon = PROVIDER_BRAND[info.id].icon;
  const color = brandColor(info.id);
  const refreshProviders = useAppStore((state) => state.refreshProviders);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isRuntimeReady =
    info.connection !== 'missing' && info.connection !== 'error' && info.connection !== 'unknown';

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshProviders();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshProviders]);

  const action = (
    <div className="flex items-center gap-2">
      <Tooltip content="Re-detect OpenCode">
        <button
          type="button"
          aria-label="Re-detect OpenCode"
          disabled={isRefreshing}
          title={isRefreshing ? 'Looking for OpenCode' : undefined}
          onClick={() => void onRefresh()}
          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <RotateCw size={14} aria-hidden />
        </button>
      </Tooltip>
    </div>
  );

  return (
    <StudioPanel
      icon={<Icon size={20} aria-hidden className="shrink-0" style={{ color }} />}
      title={info.label}
      subtitle="Runs through the OpenCode runtime"
      action={action}
    >
      <section className="flex flex-col gap-2">
        <SectionHeader
          label="Runtime"
          hint={`Sessions for ${info.label} execute through this locally installed runtime.`}
        />
        <div className="flex items-center gap-3 rounded-lg border border-border-soft bg-muted/20 p-4">
          <span
            className={
              isRuntimeReady
                ? 'text-success'
                : info.connection === 'error'
                  ? 'text-danger'
                  : 'text-warning'
            }
          >
            {isRuntimeReady ? (
              <CircleCheck size={18} aria-hidden />
            ) : info.connection === 'error' ? (
              <TriangleAlert size={18} aria-hidden />
            ) : (
              <Terminal size={18} aria-hidden />
            )}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-medium text-foreground">
              {isRuntimeReady ? 'OpenCode detected' : 'OpenCode is required'}
            </span>
            <span className="text-2xs text-muted-foreground">
              {isRuntimeReady
                ? `${info.binary}${info.version !== null ? ` ${info.version}` : ''}`
                : 'Install OpenCode, then detect the runtime again.'}
            </span>
          </div>
          <button
            type="button"
            disabled={isRefreshing}
            onClick={() => void onRefresh()}
            className="rounded-md border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            Detect
          </button>
        </div>
      </section>

      <ProviderCredentialsSection providerId={info.id} />
      <ProviderBindingsSection providerId={info.id} cliIdentity={null} />
    </StudioPanel>
  );
};
