import { ChevronDown } from 'lucide-react';
import { clampEffortForModel } from '@goodboy/core';
import { AnchoredPopover, PopoverBody, cn, useDropdown } from '@goodboy/ui';
import type { AgentEffort, ProviderId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { RoutingLabel } from '../../../../shared/components/RoutingLabel';
import { RoutingPickerBody } from '../../../../shared/components/RoutingPicker/RoutingPickerBody';
import { PickerSection } from '../../../../shared/components/RoutingPicker/PickerSection';
import { SUGGESTED_LABEL } from '../../../../shared/components/RoutingPicker/autoRecommendationCopy';
import { AGENT_FORM_GRAMMAR } from '../../agent-form-grammar';
import {
  agentKindPalette,
  AGENT_KIND_META,
  type AgentKind,
  type AgentKindRouting,
} from '../../agent-kind';
import { AgentKindGrid } from '../CreateAgentPopover/AgentKindGrid';

export type AgentStartRouting = AgentKindRouting | null;

type Props = {
  readonly kinds: ReadonlyArray<AgentKind>;
  readonly kind: AgentKind;
  readonly onKindChange: (kind: AgentKind) => void;
  readonly routing: AgentStartRouting;
  readonly suggestion: AgentKindRouting;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly onRoutingChange: (routing: AgentStartRouting) => void;
};

const chipClassName =
  'flex items-center gap-1.5 rounded-full border border-border-soft bg-background px-2 py-1 text-label text-foreground motion-safe:transition-colors hover:border-border hover:bg-hover';

export const AgentStartFields = ({
  kinds,
  kind,
  onKindChange,
  routing,
  suggestion,
  connectedProviders,
  onRoutingChange,
}: Props) => {
  const roleDropdown = useDropdown({ align: 'start', expectedWidth: 260, expectedHeight: 220 });
  const modelDropdown = useDropdown({ align: 'start', expectedWidth: 320, expectedHeight: 320 });
  const palette = agentKindPalette({ kind });
  const effective = routing ?? suggestion;

  return (
    <div className="flex items-center gap-1.5">
      <AnchoredPopover
        dropdown={roleDropdown}
        role="dialog"
        ariaLabel="Role"
        className="w-64"
        trigger={
          <button
            type="button"
            onClick={roleDropdown.toggle}
            className={chipClassName}
            aria-label={`Role: ${AGENT_KIND_META[kind].noun}`}
          >
            <span className={cn('size-1.5 shrink-0 rounded-full', palette.bg)} aria-hidden />
            {AGENT_KIND_META[kind].noun}
            <ChevronDown size={11} aria-hidden className="shrink-0 text-muted-foreground" />
          </button>
        }
      >
        <PopoverBody>
          <PickerSection label={AGENT_FORM_GRAMMAR.role.label}>
            <AgentKindGrid
              kinds={kinds}
              value={kind}
              onChange={(next) => {
                onKindChange(next);
                roleDropdown.close();
              }}
            />
          </PickerSection>
        </PopoverBody>
      </AnchoredPopover>
      <AnchoredPopover
        dropdown={modelDropdown}
        role="dialog"
        ariaLabel="Model"
        className="w-80"
        trigger={
          <button type="button" onClick={modelDropdown.toggle} className={chipClassName}>
            <CONCEPT_ICONS.autoRouting
              size={11}
              aria-hidden
              className="shrink-0 text-muted-foreground"
            />
            {routing === null ? (
              'Auto'
            ) : (
              <RoutingLabel
                provider={effective.provider}
                model={effective.model}
                effort={effective.effort}
              />
            )}
            <ChevronDown size={11} aria-hidden className="shrink-0 text-muted-foreground" />
          </button>
        }
      >
        <PopoverBody>
          <RoutingPickerBody
            connectedProviders={connectedProviders}
            provider={effective.provider}
            model={effective.model}
            effort={{
              editable: true,
              value: effective.effort,
              onChange: (effort: AgentEffort) => onRoutingChange({ ...effective, effort }),
            }}
            onClose={modelDropdown.close}
            recommendation={{ ...suggestion, label: SUGGESTED_LABEL }}
            overridden={routing !== null}
            onProvider={(provider) => {
              if (provider === '') {
                onRoutingChange(null);
                return;
              }
              onRoutingChange({ ...effective, provider });
            }}
            onModel={(model) =>
              onRoutingChange({
                ...effective,
                model,
                effort:
                  clampEffortForModel({ model, effort: effective.effort }) ?? effective.effort,
              })
            }
          />
        </PopoverBody>
      </AnchoredPopover>
    </div>
  );
};
