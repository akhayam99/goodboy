import { useEffect, useState, type ReactNode } from 'react';
import {
  AnchoredPopover,
  Button,
  Divider,
  PopoverBody,
  PopoverFooter,
  Textarea,
  useDropdown,
} from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { PickerSection } from '../../../../../../shared/components/RoutingPicker/PickerSection';
import { AgentRoutingSections } from '../../../../../session/components/CreateAgentPopover/AgentRoutingSections';
import { configFor, type CardConfig } from '../config';

type Props = {
  readonly ariaLabel: string;
  readonly config: CardConfig;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly primaryLabel: string;
  readonly onChange: (next: CardConfig) => void;
  readonly onPrimary: () => void;
  readonly renderTrigger: (open: boolean, toggle: () => void) => ReactNode;
};

export const ResolveConfigPopover = ({
  ariaLabel,
  config,
  connectedProviders,
  primaryLabel,
  onChange,
  onPrimary,
  renderTrigger,
}: Props) => {
  const dropdown = useDropdown({
    align: 'center',
    expectedHeight: 520,
    expectedWidth: 384,
    width: 'w-96 max-w-[calc(100vw-2rem)]',
  });
  const { open, close, toggle } = dropdown;
  const [viewProvider, setViewProvider] = useState<ProviderId>(config.provider);

  useEffect(() => {
    setViewProvider(config.provider);
  }, [open, config.provider]);

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={ariaLabel}
      className="flex flex-col bg-subtle"
      anchorClassName="min-w-0"
      trigger={renderTrigger(open, toggle)}
    >
      <PopoverBody>
        <PickerSection label="Instructions" hint="Notes the resolver reads before starting">
          <div className="px-2.5">
            <Textarea
              aria-label="Resolver hint"
              autoGrow
              minRows={2}
              maxRows={6}
              value={config.hint}
              onChange={(event) => onChange({ ...config, hint: event.target.value })}
              placeholder="Optional notes for the resolver: how to fix, what to avoid..."
              className="px-2 py-1.5 text-xs"
            />
          </div>
        </PickerSection>
        <Divider />
        <AgentRoutingSections
          connectedProviders={connectedProviders}
          effective={{
            provider: config.provider,
            model: config.model,
            effort: config.effort,
          }}
          viewProvider={viewProvider}
          onViewProvider={setViewProvider}
          onNavigateProviders={close}
          onPickProvider={(provider) => onChange(configFor({ provider, base: config }))}
          onPickModel={(model, effort) =>
            onChange({ ...config, provider: viewProvider, model, effort })
          }
        />
        <Divider />
      </PopoverBody>
      <PopoverFooter className="flex items-center justify-end px-2.5 py-2">
        <Button
          size="sm"
          onClick={() => {
            onPrimary();
            close();
          }}
        >
          {primaryLabel}
        </Button>
      </PopoverFooter>
    </AnchoredPopover>
  );
};
