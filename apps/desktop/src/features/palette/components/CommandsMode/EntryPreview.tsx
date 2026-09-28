import type { Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { excerptOf } from '../../excerptOf';
import type { PaletteEntry } from '../../types';
import { ExcerptBlock } from './ExcerptBlock';
import { PreviewFacts } from './PreviewFacts';
import { PreviewHeader } from './PreviewHeader';
import { SessionPreview } from './SessionPreview';

type Props = {
  readonly entry: PaletteEntry;
  readonly subject: string | null;
};

const NO_SESSIONS: ReadonlyArray<Session> = [];

export const EntryPreview = ({ entry, subject }: Props) => {
  const target = entry.target;
  const session = useAppStore((s) =>
    entry.kind === 'session' && target?.kind === 'session'
      ? ((s.sessions ?? NO_SESSIONS).find((candidate) => candidate.id === target.sessionId) ?? null)
      : null,
  );
  const agent = useAppStore((s) =>
    entry.kind === 'agent' && target?.kind === 'agent'
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

  if (session !== null) {
    return <SessionPreview session={session} />;
  }
  if (agent !== null) {
    return (
      <div className="flex flex-col gap-4">
        <PreviewHeader title={agent.name} subtitle={entry.detail} />
        <PreviewFacts facts={[{ label: 'Status', value: agent.status }]} />
      </div>
    );
  }
  const subtitle =
    entry.kind === 'verb'
      ? (subject ?? undefined)
      : [entry.tag, entry.detail].filter((part) => part !== undefined && part !== '').join(' · ');
  return (
    <div className="flex flex-col gap-4">
      <PreviewHeader title={entry.label} subtitle={subtitle} />
      {excerpt !== null && excerpt.trim() !== '' && (
        <ExcerptBlock text={excerptOf({ markdown: excerpt })} />
      )}
      {entry.action?.blockedReason != null && (
        <p className="text-label text-muted-foreground">{entry.action.blockedReason}</p>
      )}
      {entry.action?.confirm != null && (
        <p className="text-label text-muted-foreground">{entry.action.confirm.description}</p>
      )}
      {entry.shortcut !== undefined && (
        <p className="text-label text-muted-foreground">
          Shortcut <kbd className="text-code text-foreground">{shortcutGlyphs(entry.shortcut)}</kbd>
        </p>
      )}
    </div>
  );
};
