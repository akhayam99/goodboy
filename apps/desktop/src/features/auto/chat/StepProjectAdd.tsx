import { useState } from 'react';
import { Button, formatError } from '@goodboy/ui';
import type { AgentId, MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { isReportedError } from '../../../store/slices/notifications/reportedError';
import { RUN_STEP_PIN_COPY } from '../../workflows/runStepPinCopy';
import { useProjectCandidates } from './hooks/useProjectCandidates';
import { ProjectPickList } from './ProjectPickList';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

type KeyParams = {
  readonly key: string;
};

type LabelParams = {
  readonly names: ReadonlyArray<string>;
};

const addLabelOf = ({ names }: LabelParams): string => {
  const only = names[0];
  if (only === undefined) {
    return RUN_STEP_PIN_COPY.addProject;
  }
  return names.length === 1 ? `Add ${only}` : `Add ${names.length} projects`;
};

export const StepProjectAdd = ({ sessionId, agentId }: Props) => {
  const ensureProjectMounted = useAppStore((state) => state.ensureProjectMounted);
  const resolveMountBlockedStep = useAppStore((state) => state.resolveMountBlockedStep);
  const [isOpen, setIsOpen] = useState(false);
  const [picked, setPicked] = useState<ReadonlyArray<string>>([]);
  const [query, setQuery] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { others } = useProjectCandidates({ sessionId, query });

  const picks = others.filter((candidate) => picked.includes(candidate.key));

  const toggle = ({ key }: KeyParams) =>
    setPicked((current) =>
      current.includes(key) ? current.filter((value) => value !== key) : [...current, key],
    );

  const add = async (): Promise<void> => {
    if (isBusy || picks.length === 0) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const mountIds: Array<MountId> = [];
      for (const pick of picks) {
        const result = await ensureProjectMounted({
          sessionId,
          projectId: pick.projectId,
          reason: RUN_STEP_PIN_COPY.addReason,
        });
        const mountId = result.status === 'created' ? result.createdMountId : result.mountIds[0];
        if (mountId !== undefined) {
          mountIds.push(mountId);
        }
      }
      const first = mountIds[0];
      if (first === undefined) {
        throw new Error(RUN_STEP_PIN_COPY.addNothing);
      }
      await resolveMountBlockedStep({
        sessionId,
        agentId,
        choice: { kind: 'use', mountId: first },
      });
    } catch (cause) {
      if (!isReportedError(cause)) {
        setError(formatError(cause));
      }
    } finally {
      setIsBusy(false);
    }
  };

  if (!isOpen) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setIsOpen(true)}>
        {RUN_STEP_PIN_COPY.addProject}
      </Button>
    );
  }

  return (
    <div className="flex min-w-0 basis-full flex-col gap-2">
      <ProjectPickList
        shown={others}
        picked={picked}
        isDisabled={isBusy}
        hasInSession={false}
        isSearchOpen
        query={query}
        onToggle={toggle}
        onQuery={setQuery}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={picks.length === 0 || isBusy}
          isBusy={isBusy}
          busyLabel={RUN_STEP_PIN_COPY.adding}
          onClick={() => void add()}
        >
          {addLabelOf({ names: picks.map((pick) => pick.name) })}
        </Button>
        <Button size="sm" variant="quiet" disabled={isBusy} onClick={() => setIsOpen(false)}>
          {RUN_STEP_PIN_COPY.cancelAdd}
        </Button>
      </div>
      {error === null ? null : (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
    </div>
  );
};
