import { useEffect, useRef, useState } from 'react';
import { Button, FormActions, KbdPill, cn, formatError, inlineMarkdownText } from '@goodboy/ui';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import type {
  ProjectId,
  SessionExternalTaskProvider,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../shared/components/Toast';
import { issueBriefKey } from '../../../../store/slices/issue-briefs/issueBriefKey';
import { selectIssueBrief } from '../../../../store/slices/issue-briefs/selectIssueBrief';
import type { IssueBriefSource } from '../../../../store/slices/issue-briefs/types';
import { briefGoalText } from '../../shared/briefGoalText';
import { LaunchedNotice } from './LaunchedNotice';
import { BriefStrip } from './BriefStrip';
import { LaunchMountRow } from './LaunchMountRow';
import type { LaunchMount } from '../../../inbox/launchMountFor';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { PromptField } from '../../../../shared/components/PromptField';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';

type ExternalTask = {
  readonly provider: SessionExternalTaskProvider;
  readonly externalId: string;
  readonly identifier: string;
  readonly url: string;
  readonly title: string;
};

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly linkedSessionId: SessionId | null;
  readonly goalSeed: string;
  readonly externalTask: ExternalTask;
  readonly briefSource: IssueBriefSource | null;
  readonly onClose: () => void;
  readonly focusRequest?: number;
  readonly mount?: LaunchMount | null;
};

export const LaunchSessionPanel = ({
  workspaceId,
  linkedSessionId,
  goalSeed,
  externalTask,
  briefSource,
  onClose,
  focusRequest = 0,
  mount = null,
}: Props) => {
  const createSession = useAppStore((state) => state.createSession);
  const requestIssueBrief = useAppStore((state) => state.requestIssueBrief);
  const briefKey = briefSource === null ? null : issueBriefKey({ source: briefSource });
  const brief = useAppStore((state) => selectIssueBrief({ state, key: briefKey }));
  const { showToast } = useToast();
  const [isShowingBrief, setIsShowingBrief] = useState(true);
  const readyBrief = brief?.status === 'ready' && briefSource !== null ? brief : null;
  const briefGoal =
    readyBrief === null || briefSource === null
      ? null
      : briefGoalText({ brief: readyBrief.brief, source: briefSource });
  const seed = isShowingBrief && briefGoal !== null ? briefGoal : goalSeed;
  const briefTitle = isShowingBrief && readyBrief !== null ? readyBrief.brief.title : null;
  const [goal, setGoal] = useState(seed);
  const [isBusy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountSeed = mount?.selectedId ?? null;
  const [projectId, setProjectId] = useState<ProjectId | null>(mountSeed);
  const [isProjectPicked, setIsProjectPicked] = useState(false);
  const goalSeedRef = useRef(seed);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (focusRequest === 0) {
      return;
    }
    const goalField = sectionRef.current?.querySelector('textarea') ?? null;
    goalField?.focus();
  }, [focusRequest]);

  useEffect(() => {
    if (!isProjectPicked) {
      setProjectId(mountSeed);
    }
  }, [isProjectPicked, mountSeed]);

  useEffect(() => {
    const previousSeed = goalSeedRef.current;
    goalSeedRef.current = seed;
    setGoal((current) => (current === previousSeed ? seed : current));
  }, [seed]);

  const briefSourceRef = useRef(briefSource);
  briefSourceRef.current = briefSource;
  const briefSignature = briefSource === null ? null : `${briefSource.title}\n${briefSource.body}`;

  useEffect(() => {
    const source = briefSourceRef.current;
    if (source === null || linkedSessionId !== null) {
      return;
    }
    void requestIssueBrief({ source, workspaceId, sessionId: null });
  }, [briefKey, briefSignature, linkedSessionId, requestIssueBrief, workspaceId]);

  const toggleBrief = () => {
    const next = !isShowingBrief;
    const nextSeed = next && briefGoal !== null ? briefGoal : goalSeed;
    goalSeedRef.current = nextSeed;
    setIsShowingBrief(next);
    setGoal(nextSeed);
  };

  const retryBrief = () => {
    if (briefSource === null) {
      return;
    }
    void requestIssueBrief({ source: briefSource, workspaceId, sessionId: null, isRetry: true });
  };

  const canLaunch = goal.trim() !== '' && !isBusy;

  const launch = async () => {
    setError(null);
    setBusy(true);
    try {
      const { session } = await createSession({
        workspaceId,
        goal,
        ...(briefTitle !== null && { title: briefTitle }),
        ...(mount !== null && projectId !== null && { projectId, projectReason: mount.reason }),
        externalTasks: [externalTask],
      });
      showToast({
        kind: 'success',
        message: `Session created: ${inlineMarkdownText({ text: session.goal })}`,
      });
      onClose();
    } catch (launchError) {
      setError(formatError(launchError));
    } finally {
      setBusy(false);
    }
  };

  if (linkedSessionId != null) {
    return <LaunchedNotice sessionId={linkedSessionId} isLinkedToIssue onOpened={onClose} />;
  }

  return (
    <section
      ref={sectionRef}
      aria-label="Launch session"
      className="flex flex-col gap-1 rounded-md bg-subtle p-2 ring-1 ring-border-soft motion-safe:transition-shadow focus-within:ring-2 focus-within:ring-focus-ring"
    >
      {briefSource !== null && brief !== null && brief.status !== 'unavailable' && (
        <BriefStrip
          source={briefSource}
          entry={brief}
          isShowingBrief={isShowingBrief}
          onToggle={toggleBrief}
          onRetry={retryBrief}
        />
      )}
      {briefTitle !== null && (
        <p className="px-2 text-label font-semibold text-foreground">{briefTitle}</p>
      )}
      {mount !== null && (
        <LaunchMountRow
          mount={mount}
          selectedId={projectId}
          disabled={isBusy}
          onChange={(next) => {
            setIsProjectPicked(true);
            setProjectId(next);
          }}
        />
      )}
      <PromptField
        variant="bare"
        kind="document"
        value={goal}
        onChange={setGoal}
        onSubmit={() => void launch()}
        isSubmitBlocked={!canLaunch}
        minRows={2}
        maxRows={10}
        disabled={isBusy}
        label="Session goal"
        placeholder="What should this session do?"
        textClassName="px-2 leading-relaxed"
      />

      {error != null ? (
        <span role="alert" className="flex items-start gap-1 px-2 text-meta text-danger">
          <AlertTriangle size={ICON_SIZE.row} aria-hidden className="mt-0.5 shrink-0" />
          {error}
        </span>
      ) : null}

      <FormActions
        className="px-1"
        leading={
          brief?.status === 'loading' || readyBrief !== null ? (
            <p className="min-w-0 truncate px-1 text-meta text-faint-foreground">
              Edited text is never replaced by the brief.
            </p>
          ) : null
        }
      >
        <Button size="sm" onClick={() => void launch()} disabled={!canLaunch} className="shrink-0">
          <span className={cn(isBusy && 'text-shimmer')}>
            {isBusy ? 'Launching…' : 'Launch session'}
          </span>
          {!isBusy ? <KbdPill>{shortcutGlyphs('composer.submit')}</KbdPill> : null}
          {!isBusy ? <ArrowRight size={ICON_SIZE.row} aria-hidden /> : null}
        </Button>
      </FormActions>
    </section>
  );
};
