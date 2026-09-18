import type { AgentId, SessionId } from '@goodboy/types';
import { tintClasses } from '@goodboy/ui';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { openLens } from '../../../session/openLens';
import { resolveArtifactForBlock } from '../../../artifacts/resolveArtifactForBlock';
import type { TranscriptItem } from '../../utils/transcript-items';
import { TranscriptDisclosure } from '../TranscriptDisclosure';
import { TranscriptRowHeader } from '../TranscriptRowHeader';
import { TranscriptShell } from '../TranscriptShell';
import { CONCEPT_ICONS, CONCEPT_TONE, ICON_SIZE } from '../../../../shared/components/conceptIcons';

const accent = tintClasses(CONCEPT_TONE.plans);

const KIND_LABEL: Record<string, string> = {
  plan: 'Plan',
  report: 'Report',
  wireframe: 'Wireframe',
};

type SentenceParams = Readonly<{
  artifactKind: string;
  complete: boolean;
}>;

const previewSentence = ({ artifactKind, complete }: SentenceParams): string => {
  const label = KIND_LABEL[artifactKind];
  if (!complete) {
    return `${artifactKind} still arriving`;
  }
  if (label === undefined) {
    return 'Artifact ready';
  }
  return `${label} not in this session`;
};

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'artifact_block' }>;
  readonly sessionId: SessionId | null;
  readonly agentId: AgentId | null;
};

export const ArtifactBlockCard = ({ item, sessionId, agentId }: Props) => {
  const artifacts = useAppStore((s) =>
    sessionId === null ? EMPTY_ARRAY : (s.sessionArtifacts[sessionId] ?? EMPTY_ARRAY),
  );
  const setFocusedArtifactId = useAppStore((s) => s.setFocusedArtifactId);
  const setFocusedPlanId = useAppStore((s) => s.setFocusedPlanId);

  const resolved = item.complete
    ? resolveArtifactForBlock({
        artifacts,
        agentId,
        runId: item.runId,
        artifactKind: item.artifactKind,
      })
    : null;
  const kindLabel = KIND_LABEL[item.artifactKind] ?? item.artifactKind;

  if (resolved !== null && sessionId !== null) {
    const onClick = () => {
      if (resolved.kind === 'plan') {
        setFocusedPlanId(sessionId, resolved.id);
      } else {
        setFocusedArtifactId(sessionId, resolved.id);
      }
      openLens({ sessionId, lens: 'plans' });
    };

    return (
      <TranscriptShell
        as="button"
        type="button"
        onClick={onClick}
        data-testid="artifact-block-chip"
        tone={CONCEPT_TONE.plans}
        variant="pill"
        className={`inline-flex w-fit items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-80 ${accent.text}`}
      >
        <CONCEPT_ICONS.artifacts size={ICON_SIZE.row} aria-hidden />
        <span className="min-w-0 truncate">
          {kindLabel} · {resolved.title}
        </span>
      </TranscriptShell>
    );
  }

  return (
    <TranscriptDisclosure
      tone="neutral"
      open={false}
      header={
        <TranscriptRowHeader
          grouped
          tone="neutral"
          icon={<CONCEPT_ICONS.artifacts size={ICON_SIZE.row} aria-hidden />}
          eyebrow="artifact"
          data-testid="artifact-block-row"
          preview={
            <span className="flex min-w-0 items-center gap-2">
              <span className="shrink-0">
                {previewSentence({ artifactKind: item.artifactKind, complete: item.complete })}
              </span>
              {item.title !== null ? (
                <span className="min-w-0 truncate text-xs font-medium text-foreground">
                  {item.title}
                </span>
              ) : null}
            </span>
          }
        />
      }
    />
  );
};
