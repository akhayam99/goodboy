import { useCallback, useEffect, useRef, useState } from 'react';
import type { PermissionRule, WorkspaceId } from '@goodboy/types';
import {
  invokePermissionRuleDelete,
  invokePermissionRuleList,
  invokePermissionRuleUpsert,
} from '../../permissions';

type Params = {
  readonly workspaceId: WorkspaceId;
};

export type NewRule = {
  readonly decision: 'allow' | 'deny';
  readonly command: string;
  readonly where: 'workspace' | 'global';
};

export type PermissionRules = {
  readonly rules: ReadonlyArray<PermissionRule>;
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly retry: () => void;
  readonly remove: (rule: PermissionRule) => Promise<void>;
  readonly add: (rule: NewRule) => Promise<void>;
};

const toError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(String(value));

export const usePermissionRules = ({ workspaceId }: Params): PermissionRules => {
  const [rules, setRules] = useState<ReadonlyArray<PermissionRule>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const generation = useRef(0);

  const load = useCallback(async () => {
    generation.current += 1;
    const active = generation.current;
    setIsLoading(true);
    setError(null);
    try {
      const [workspaceRules, globalRules] = await Promise.all([
        invokePermissionRuleList({ scope: 'workspace', workspaceId }),
        invokePermissionRuleList({ scope: 'global' }),
      ]);
      if (generation.current !== active) {
        return;
      }
      setRules([...workspaceRules, ...globalRules]);
    } catch (value) {
      if (generation.current !== active) {
        return;
      }
      setError(toError(value));
    } finally {
      if (generation.current === active) {
        setIsLoading(false);
      }
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
    return () => {
      generation.current += 1;
    };
  }, [load]);

  const retry = useCallback(() => {
    void load();
  }, [load]);

  const remove = useCallback(async (rule: PermissionRule) => {
    await invokePermissionRuleDelete({ id: rule.id });
    setRules((current) => current.filter((candidate) => candidate.id !== rule.id));
  }, []);

  const add = useCallback(
    async ({ decision, command, where }: NewRule) => {
      const created = await invokePermissionRuleUpsert({
        scope: where,
        ...(where === 'workspace' ? { workspaceId } : {}),
        patternTool: 'Bash',
        patternArgsMatcher: `${command.trim()} *`,
        decision,
        priority: 100,
      });
      setRules((current) => [created, ...current.filter((rule) => rule.id !== created.id)]);
    },
    [workspaceId],
  );

  return { rules, isLoading, error, retry, remove, add };
};
