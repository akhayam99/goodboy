import { ChevronDown } from 'lucide-react';
import { clampEffortForModel } from '@goodboy/core';
import { AnchoredPopover, PopoverBody, SelectableRow, cn, useDropdown } from '@goodboy/ui';
import type { AgentEffort, Project, ProjectId, ProviderId } from '@goodboy/types';
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
import { projectById } from '../../../../store/slices/projects/projectIndex';

export type AgentStartRouting = AgentKindRouting | null;

type Props = {
  readonly kinds: ReadonlyArray<AgentKind>;
  readonly kind: AgentKind;
  readonly onKindChange: (kind: AgentKind) => void;
  readonly routing: AgentStartRouting;
  readonly suggestion: AgentKindRouting;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly onRoutingChange: (routing: AgentStartRouting) => void;
  readonly projects: ReadonlyArray<Project>;
  readonly projectId: ProjectId | null;
  readonly onProjectChange: (projectId: ProjectId) => void;
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
  projects,
  projectId,
  onProjectChange,
}: Props) => {
  const roleDropdown = useDropdown({ align: 'start', expectedWidth: 260, expectedHeight: 220 });
  const modelDropdown = useDropdown({ align: 'start', expectedWidth: 320, expectedHeight: 320 });
  const projectDropdown = useDropdown({ align: 'start', expectedWidth: 240, expectedHeight: 200 });
  const palette = agentKindPalette({ kind });
  const effective = routing ?? suggestion;
  const selectedProject = projectById(projects, projectId) ?? null;

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
                  clampEffortForModel({
                    model,
                    effort: effective.effort,
                    provider: effective.provider,
                  }) ?? effective.effort,
              })
            }
          />
        </PopoverBody>
      </AnchoredPopover>
      {projects.length > 1 && (
        <AnchoredPopover
          dropdown={projectDropdown}
          role="dialog"
          ariaLabel="Project"
          className="w-60"
          trigger={
            <button
              type="button"
              onClick={projectDropdown.toggle}
              className={chipClassName}
              aria-label={`Project: ${selectedProject?.name ?? 'none'}`}
            >
              {selectedProject?.name ?? 'Project'}
              <ChevronDown size={11} aria-hidden className="shrink-0 text-muted-foreground" />
            </button>
          }
        >
          <PopoverBody>
            <div role="listbox" aria-label="Project" className="flex flex-col gap-0.5 px-1.5 py-1">
              {projects.map((project) => (
                <SelectableRow
                  key={project.id}
                  role="option"
                  ariaSelected={project.id === projectId}
                  selected={project.id === projectId}
                  onClick={() => {
                    onProjectChange(project.id);
                    projectDropdown.close();
                  }}
                  className="px-2 py-1.5 text-label"
                >
                  {project.name}
                </SelectableRow>
              ))}
            </div>
          </PopoverBody>
        </AnchoredPopover>
      )}
    </div>
  );
};
