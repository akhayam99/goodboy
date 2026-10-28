import type { Ref } from 'react';
import { DEFAULT_GROUPS, ROLE_REGISTRY, TASKS, isAutoOwnProvider } from '@goodboy/core';
import { Band, BandStack, Eyebrow } from '@goodboy/ui';
import type {
  AgentRole,
  AuxTaskId,
  OverrideSettings,
  ProviderId,
  RoleModelPreference,
  TaskModelPreference,
  WorkspaceId,
} from '@goodboy/types';
import { NAMES } from '../../../../../shared/utils/names';
import { ROLE_LABEL } from '../../../../session/agent-kind';
import { RoleRow } from './RoleRow';
import { TaskModelRow } from './TaskModelRow';

const TASK_BY_ID = new Map(TASKS.map((task) => [task.id, task]));

const RUNS_HELP =
  'The models a new run starts with. Start a run and the run page let one run use another.';

type RoleChangeParams = {
  readonly role: AgentRole;
  readonly preference: RoleModelPreference | null;
};

type TaskChangeParams = {
  readonly task: AuxTaskId;
  readonly preference: TaskModelPreference | null;
};

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly overrides: OverrideSettings;
  readonly connectedProviderIds: ReadonlyArray<ProviderId>;
  readonly isDisabled: boolean;
  readonly sectionRef: Ref<HTMLElement>;
  readonly onRoleChange: (params: RoleChangeParams) => void;
  readonly onTaskChange: (params: TaskChangeParams) => void;
};

export const RunsSection = ({
  workspaceId,
  overrides,
  connectedProviderIds,
  isDisabled,
  sectionRef,
  onRoleChange,
  onTaskChange,
}: Props) => (
  <section ref={sectionRef} aria-label={NAMES.runs} className="flex flex-col gap-2">
    <Eyebrow label={NAMES.runs} />
    <p className="text-meta text-muted-foreground">{RUNS_HELP}</p>
    <BandStack>
      <Band>
        {DEFAULT_GROUPS.runs.agents.map((role) => (
          <RoleRow
            key={role}
            workspaceId={workspaceId}
            role={role}
            label={ROLE_LABEL[role]}
            help={ROLE_REGISTRY[role].summary}
            preference={overrides.roleModels?.[role] ?? null}
            isParallelOn={overrides.parallelAgents === true}
            connectedProviderIds={
              role === 'auto'
                ? connectedProviderIds.filter((id) => isAutoOwnProvider({ provider: id }))
                : connectedProviderIds
            }
            disabled={isDisabled}
            onChange={(preference) => onRoleChange({ role, preference })}
          />
        ))}
        {DEFAULT_GROUPS.runs.tasks.map((taskId) => {
          const task = TASK_BY_ID.get(taskId);
          if (task == null) {
            return null;
          }
          return (
            <TaskModelRow
              key={task.id}
              workspaceId={workspaceId}
              task={task.id}
              label={task.label}
              help={task.description}
              preference={overrides.taskModels?.[task.id] ?? null}
              connectedProviderIds={connectedProviderIds}
              disabled={isDisabled}
              onChange={(preference) => onTaskChange({ task: task.id, preference })}
            />
          );
        })}
      </Band>
    </BandStack>
  </section>
);
