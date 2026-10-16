import { AnchoredPopover, PopoverBody, useDropdown } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import type { PickedRoute } from '../../../shared/components/RoutingPicker/PickedRoute';
import { ControlChip } from '../../../shared/components/ControlChip';
import { ModelControlChip } from '../../../shared/components/ModelControlChip';
import { AGENT_FORM_GRAMMAR } from '../agent-form-grammar';
import { AGENT_KIND_META, type AgentKind, type AgentKindRouting } from '../agent-kind';
import { AgentKindGrid } from './CreateAgentPopover/AgentKindGrid';

export type AgentStartRouting = AgentKindRouting | null;

type LastUsed = {
  readonly routing: AgentKindRouting;
  readonly isActive: boolean;
  readonly onSelect: () => void;
};

type Props = {
  readonly kinds: ReadonlyArray<AgentKind>;
  readonly kind: AgentKind;
  readonly onKindChange: (kind: AgentKind) => void;
  readonly routing: AgentStartRouting;
  readonly suggestion: AgentKindRouting;
  readonly suggestionReason?: string;
  readonly lastUsed?: LastUsed | null;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly isDisabled?: boolean;
  readonly onRoutingChange: (routing: AgentStartRouting) => void;
};

export const AgentStartFields = ({
  kinds,
  kind,
  onKindChange,
  routing,
  suggestion,
  suggestionReason,
  lastUsed = null,
  connectedProviders,
  isDisabled = false,
  onRoutingChange,
}: Props) => {
  const roleDropdown = useDropdown({
    align: 'start',
    disabled: isDisabled,
    expectedWidth: 320,
    expectedHeight: 220,
  });
  const effective = routing ?? suggestion;
  const noun = AGENT_KIND_META[kind].noun;

  const pickRoute = (route: PickedRoute | null) => {
    if (route === null || route.provider === '') {
      onRoutingChange(null);
      return;
    }
    onRoutingChange({ ...effective, ...route, provider: route.provider });
  };

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {kinds.length > 1 ? (
        <AnchoredPopover
          dropdown={roleDropdown}
          role="dialog"
          ariaLabel={AGENT_FORM_GRAMMAR.role.label}
          className="w-80"
          trigger={
            <ControlChip
              label={AGENT_FORM_GRAMMAR.role.label}
              value={noun}
              isOpen={roleDropdown.open}
              isDisabled={isDisabled}
              onToggle={roleDropdown.toggle}
            />
          }
        >
          <PopoverBody>
            <AgentKindGrid
              kinds={kinds}
              value={kind}
              onChange={(next) => {
                onKindChange(next);
                roleDropdown.close();
              }}
            />
          </PopoverBody>
        </AnchoredPopover>
      ) : null}
      <ModelControlChip
        connectedProviders={connectedProviders}
        effective={effective}
        suggestion={suggestion}
        {...(suggestionReason !== undefined && { suggestionReason })}
        lastUsed={lastUsed}
        isOverridden={routing !== null}
        isDisabled={isDisabled}
        onChange={pickRoute}
      />
    </div>
  );
};
