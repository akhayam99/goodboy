import { useMemo } from 'react';
import type { Resolution, ResolvePins, ResolveSlot } from '@goodboy/core';
import type { AgentRole, AuxTaskId, StepSize } from '@goodboy/types';
import { resolutionOf } from '../../../../store/slices/models/selectResolution';
import { useModelScope, type ScopeProps } from '../useModelScope';

type SlotProps =
  | { readonly role: AgentRole; readonly task?: never }
  | { readonly task: AuxTaskId; readonly role?: never };

type Props = SlotProps &
  ScopeProps & {
    readonly pins?: ResolvePins;
    readonly size?: StepSize | null;
    readonly isAutoOnly?: boolean;
  };

export const useResolution = ({
  role,
  task,
  sessionId,
  workspaceId,
  pins,
  size,
  isAutoOnly,
}: Props): Resolution => {
  const scope = useModelScope({ sessionId, workspaceId });
  const slot = useMemo(
    (): ResolveSlot =>
      role === undefined ? { kind: 'task', id: task } : { kind: 'role', id: role },
    [role, task],
  );
  return useMemo(
    () =>
      resolutionOf({
        scope,
        slot,
        ...(pins !== undefined && { pins }),
        ...(size !== undefined && { size }),
        ...(isAutoOnly !== undefined && { isAutoOnly }),
      }),
    [scope, slot, pins, size, isAutoOnly],
  );
};
