import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { excerptOf } from '../../excerptOf';
import type { PaletteEntry } from '../../types';
import { ExcerptBlock } from './ExcerptBlock';
import { PreviewFacts } from './PreviewFacts';
import { PreviewHeader } from './PreviewHeader';
import { SessionPreview } from './SessionPreview';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';

const sentenceCase = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

type Props = {
  readonly entry: PaletteEntry;
  readonly subject: string | null;
};

export const EntryPreview = ({ entry, subject }: Props) => {
  const target = entry.target;
  const session = useAppStore((s) =>
    target?.kind === 'session'
      ? (sessionById(s.sessions, target.sessionId) ??
        Object.values(s.archivedSessions)
          .flat()
          .find((candidate) => candidate.id === target.sessionId) ??
        null)
      : null,
  );
  const agent = useAppStore((s) =>
    target?.kind === 'agent'
      ? ((s.sessionPhaseRuns[target.sessionId] ?? EMPTY_ARRAY).find(
          (candidate) => candidate.id === target.agentId,
        ) ?? null)
      : null,
  );
  const excerpt = useAppStore((s) => {
    if (entry.kind !== 'artifact') {
      return null;
    }
    const artifactId = entry.key.slice('artifact:'.length);
    const plan = Object.values(s.sessionPlans)
      .flat()
      .find((candidate) => candidate.id === artifactId);
    if (plan !== undefined) {
      return plan.bodyMd;
    }
    const artifact = Object.values(s.sessionArtifacts)
      .flat()
      .find((candidate) => candidate.id === artifactId);
    return artifact !== undefined && artifact.sourceFormat === 'markdown'
      ? artifact.sourceText
      : null;
  });

  const objectPreview =
    session !== null ? (
      <SessionPreview session={session} subject={subject} />
    ) : agent !== null ? (
      <div className="flex flex-col gap-4">
        <PreviewHeader
          title={agent.name}
          subtitle={entry.kind === 'agent' ? entry.detail : 'Agent'}
        />
        <PreviewFacts
          facts={[
            { label: 'Status', value: sentenceCase(agent.status) },
            ...(agent.modelOverride == null
              ? []
              : [{ label: 'Model', value: agent.modelOverride }]),
          ]}
        />
      </div>
    ) : null;
  if (objectPreview !== null) {
    return (
      <div className="flex flex-col gap-4">
        {objectPreview}
        {entry.action?.blockedReason != null && (
          <p className="text-meta text-muted-foreground">{entry.action.blockedReason}</p>
        )}
        {entry.action?.confirm != null && (
          <p className="text-meta text-muted-foreground">{entry.action.confirm.description}</p>
        )}
      </div>
    );
  }
  const hasExcerpt = excerpt !== null && excerpt.trim() !== '';
  return (
    <div className="flex flex-col gap-4">
      {hasExcerpt ? <PreviewHeader title={entry.label} /> : null}
      {hasExcerpt ? <ExcerptBlock text={excerptOf({ markdown: excerpt })} /> : null}
      {entry.action?.blockedReason != null && (
        <p className="text-meta text-muted-foreground">{entry.action.blockedReason}</p>
      )}
      {entry.action?.confirm != null && (
        <p className="text-meta text-muted-foreground">{entry.action.confirm.description}</p>
      )}
    </div>
  );
};
