import { useState } from 'react';
import { ChevronRight, KeyRound } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { isApiProvider } from '@goodboy/core';
import { Button, Chip, FOCUS_RING, Reveal, cn } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { PROVIDER_LABEL } from '../../../providers/providerLabel';
import { ProviderInlineConnect } from '../../../providers/components/ProviderInlineConnect';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { AgentGlyph } from './AgentGlyph';
import { StepListRow } from './StepListRow';
import { StepStatus } from './StepStatus';

const KEY_PROVIDERS: ReadonlyArray<ProviderId> = ['openrouter', 'moonshot', 'opencode'];

type Props = {
  readonly defaultId: ProviderId | null;
  readonly isLocked: boolean;
  readonly onMakeDefault: (providerId: ProviderId) => void;
};

export const ApiKeyAgents = ({ defaultId, isLocked, onMakeDefault }: Props) => {
  const readyIds = useAppStore(
    useShallow((state) =>
      state.providers
        .filter(
          (provider) => isApiProvider({ id: provider.id }) && provider.connection === 'connected',
        )
        .map((provider) => provider.id),
    ),
  );
  const [isOpen, setIsOpen] = useState(() => readyIds.length > 0);
  const [openId, setOpenId] = useState<ProviderId | null>(null);
  const names = KEY_PROVIDERS.map((id) => PROVIDER_LABEL[id]).join(', ');

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((wasOpen) => !wasOpen)}
        className={cn(
          'flex items-center gap-2 self-start rounded-md py-1 pr-2 text-label text-muted-foreground hover:text-foreground',
          FOCUS_RING,
        )}
      >
        <ChevronRight
          size={ICON_SIZE.row}
          aria-hidden
          className={cn('motion-safe:transition-transform', isOpen && 'rotate-90')}
        />
        Use an API key instead
        <span className="text-faint-foreground">{names}</span>
      </button>
      <Reveal open={isOpen}>
        <ul className="flex flex-col rounded-lg bg-fill p-1">
          {KEY_PROVIDERS.map((id) => {
            const isReady = readyIds.includes(id);
            const isRowOpen = openId === id && !isReady;
            return (
              <StepListRow
                key={id}
                rowId={id}
                isCompact
                icon={<AgentGlyph providerId={id} size={ICON_SIZE.hero} />}
                name={PROVIDER_LABEL[id]}
                line=""
                trailing={
                  isReady ? (
                    <>
                      {defaultId === id ? (
                        <Chip tone="primary" size="sm" label="Default" shape="badge" />
                      ) : (
                        <Button
                          size="xs"
                          variant="quiet"
                          disabled={isLocked}
                          aria-label={`Make ${PROVIDER_LABEL[id]} the default agent`}
                          onClick={() => onMakeDefault(id)}
                        >
                          Make default
                        </Button>
                      )}
                      <StepStatus tone="success" label="Ready" />
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant={isRowOpen ? 'quiet' : 'secondary'}
                      aria-expanded={isRowOpen}
                      aria-label={`Add a key for ${PROVIDER_LABEL[id]}`}
                      onClick={() => setOpenId(isRowOpen ? null : id)}
                    >
                      <KeyRound size={ICON_SIZE.control} aria-hidden />
                      Add key
                    </Button>
                  )
                }
                isPanelOpen={isRowOpen}
                panel={<ProviderInlineConnect providerId={id} onDone={() => setOpenId(null)} />}
              />
            );
          })}
        </ul>
      </Reveal>
    </div>
  );
};
