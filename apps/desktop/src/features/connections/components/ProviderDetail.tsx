import { useEffect } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { PANE_RHYTHM, PageColumn, SkeletonRows, cn, tintClasses } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import { StudioTrail } from '../../../shared/components/StudioShell/StudioTrail';
import { NAMES } from '../../../shared/utils/names';
import { useAppStore } from '../../../store';
import { ProviderDetailBody } from '../../providers/ProviderDetailBody';
import { PROVIDER_LABEL } from '../../providers/providerLabel';
import { refreshStaleProviders } from '../../providers/refreshStaleProviders';
import type { ConnectionsFocus } from '../connectionsFocus';
import { openConnection } from '../openConnection';

type Props = {
  readonly focus: Extract<ConnectionsFocus, { readonly kind: 'provider' }>;
  readonly workspaceId: WorkspaceId | null;
};

const MODELS_SECTION = 'models';

const USAGE_SECTION = 'usage';

export const ProviderDetail = ({ focus, workspaceId }: Props) => {
  const { provider } = focus;
  const info = useAppStore((state) => state.providers.find((item) => item.id === provider));
  const toIndex = () => openConnection({ focus: null, isUp: true });

  useEffect(() => {
    refreshStaleProviders({ providerIds: [provider] });
  }, [provider]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageColumn
        width="column"
        className={cn('flex shrink-0 items-center empty:hidden', PANE_RHYTHM.firstRow)}
      >
        <StudioTrail
          segments={[
            {
              id: 'connections',
              label: NAMES.connections,
              icon: CONCEPT_ICONS.connections,
              iconClassName: tintClasses(CONCEPT_TONE.connections).icon,
              onSelect: toIndex,
            },
            { id: provider, label: PROVIDER_LABEL[provider], icon: CONCEPT_ICONS.providers },
          ]}
        />
      </PageColumn>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {info === undefined ? (
          <SkeletonRows label={`Loading ${PROVIDER_LABEL[provider]}`} className="px-6 py-4" />
        ) : (
          <ProviderDetailBody
            info={info}
            shouldAutoConnect={focus.action !== undefined && focus.action !== 'update'}
            shouldAutoUpdate={focus.action === 'update'}
            isModelsFocused={focus.section === MODELS_SECTION}
            isUsageFocused={focus.section === USAGE_SECTION}
            workspaceId={workspaceId}
            page="connections"
          />
        )}
      </div>
    </div>
  );
};
