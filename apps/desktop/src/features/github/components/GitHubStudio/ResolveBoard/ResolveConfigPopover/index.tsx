import { useEffect, useState, type ReactNode } from 'react';
import {
  Button,
  cn,
  Divider,
  DropdownPortal,
  Popover,
  PopoverBody,
  PopoverFooter,
  type SegmentedTabOption,
  SegmentedTabs,
  Textarea,
  useDropdown,
} from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import type { ResolveMode } from '../../../../../chat/spawn-from-comment';
import { PickerSection } from '../../../../../../shared/components/RoutingPicker/PickerSection';
import { AgentRoutingSections } from '../../../../../session/components/CreateAgentPopover/AgentRoutingSections';
import { configFor, type CardConfig } from '../config';

const MODE_OPTIONS: ReadonlyArray<SegmentedTabOption<ResolveMode>> = [
  { label: 'Fix', value: 'fix' },
  { label: 'Analyze', value: 'analyze' },
];

const MODE_HINT: Record<ResolveMode, string> = {
  fix: 'Edits the code and resolves the thread',
  analyze: 'Read-only: investigates and reports a verdict',
};

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
  const {
    open,
    close,
    toggle,
    containerRef,
    popupRef,
    popupClassName,
    popupStyle,
    portal,
    portalTarget,
  } = useDropdown({
    align: 'end',
    expectedHeight: 520,
    expectedWidth: 384,
    width: 'w-96 max-w-[calc(100vw-2rem)]',
    strategy: 'fixed',
  });
  const [viewProvider, setViewProvider] = useState<ProviderId>(config.provider);

  useEffect(() => {
    setViewProvider(config.provider);
  }, [open, config.provider]);

  return (
    <div ref={containerRef} className="relative min-w-0">
      {renderTrigger(open, toggle)}
      <DropdownPortal portal={portal} portalTarget={portalTarget}>
        {open && (
          <Popover
            innerRef={popupRef}
            role="dialog"
            ariaLabel={ariaLabel}
            className={cn(popupClassName, 'flex flex-col bg-subtle')}
            style={popupStyle}
          >
            <PopoverBody>
              <PickerSection label="Mode" hint={MODE_HINT[config.mode]}>
                <div className="px-2.5">
                  <SegmentedTabs
                    ariaLabel="Resolver mode"
                    value={config.mode}
                    options={MODE_OPTIONS}
                    onChange={(mode) => onChange({ ...config, mode })}
                    size="sm"
                    fill
                  />
                </div>
              </PickerSection>
              <Divider />
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
                onPickProvider={(provider) => onChange(configFor({ provider, base: config }))}
                onPickModel={(model, effort) =>
                  onChange({ ...config, provider: viewProvider, model, effort })
                }
                onConnectProvider={(provider) => {
                  window.dispatchEvent(
                    new CustomEvent('goodboy:open-provider-studio', {
                      detail: { providerId: provider },
                    }),
                  );
                  close();
                }}
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
          </Popover>
        )}
      </DropdownPortal>
    </div>
  );
};
