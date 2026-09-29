import { resolveStoredModelSelection } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { RoutingPicker } from '../../../../shared/components/RoutingPicker';
import type { ChatModelChoice } from '../../defaultChatModel';

type Props = {
  readonly choice: ChatModelChoice;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly onChange: (update: (current: ChatModelChoice) => ChatModelChoice) => void;
};

export const DRAFTED_BY_LABEL = 'Drafted by';

export const DraftedBy = ({ choice, connectedProviders, onChange }: Props) => (
  <div className="flex min-w-0 items-center gap-1.5">
    <span className="text-secondary text-muted-foreground">{DRAFTED_BY_LABEL}</span>
    <RoutingPicker
      ariaLabel={DRAFTED_BY_LABEL}
      variant="pill"
      align="start"
      availability="run"
      isEffortHidden
      connectedProviders={connectedProviders}
      provider={choice.provider}
      model={choice.model}
      effort={{ editable: false }}
      disabled={false}
      onProvider={(provider) => {
        if (provider === '') {
          return;
        }
        onChange((current) => ({ ...current, provider }));
      }}
      onModel={(model) =>
        onChange((current) => ({
          ...current,
          model: resolveStoredModelSelection({ provider: current.provider, id: model }).selection
            .key,
        }))
      }
    />
  </div>
);
