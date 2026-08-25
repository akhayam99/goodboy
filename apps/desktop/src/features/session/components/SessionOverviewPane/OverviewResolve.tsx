import { Chip, Eyebrow } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import type { LensKind } from '../../../../store';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useResolverIndex } from '../../hooks/useResolverIndex';
import type { ResolverStatus } from '../../resolver-linkage';

type Props = {
  readonly session: Session;
  readonly onSelectLens: (lens: LensKind) => void;
};

const SETTLED: ReadonlySet<ResolverStatus> = new Set<ResolverStatus>([
  'resolved',
  'wontfix',
  'stopped',
  'done',
]);

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

export const OverviewResolve = ({ session, onSelectLens }: Props) => {
  const sessionId = session.id;
  const resolverIndex = useResolverIndex(sessionId);
  const prDetail = useAppStore((s) => s.sessionGithub[sessionId]?.detail ?? null);
  const pendingResolutions = useAppStore(
    (s) => s.sessionPendingResolutions[sessionId] ?? EMPTY_ARRAY,
  );

  const openResolvers = resolverIndex.links.filter((link) => !SETTLED.has(link.status));
  const runningResolvers = openResolvers.filter((link) => link.status === 'running').length;
  const openComments = (prDetail?.comments ?? []).filter(
    (comment) => comment.source === 'review' && comment.resolved === false,
  ).length;
  const pendingCount = pendingResolutions.length;

  if (openComments === 0 && openResolvers.length === 0 && pendingCount === 0) {
    return null;
  }

  const label =
    openComments > 0
      ? `${plural(openComments, 'comment')} to resolve`
      : openResolvers.length > 0
        ? `${plural(openResolvers.length, 'resolver')} still open`
        : `${plural(pendingCount, 'resolution')} ready to push`;
  const meta =
    runningResolvers > 0
      ? `${runningResolvers} running`
      : pendingCount > 0
        ? `${pendingCount} ready to push`
        : null;

  return (
    <section aria-label="Resolve" className="flex flex-col gap-2">
      <Eyebrow label="Resolve" className="px-0.5" />
      <button
        type="button"
        onClick={() => onSelectLens('resolve')}
        className="flex w-full items-center gap-2 rounded-lg border-l-2 border-border-soft px-3 py-1.5 text-left hover:bg-muted/40"
      >
        <CONCEPT_ICONS.resolve size={13} aria-hidden className="shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">{label}</span>
        {meta !== null ? <Chip tone="accent" size="3xs" bordered={false} label={meta} /> : null}
      </button>
    </section>
  );
};
