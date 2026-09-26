import type { ArtifactId, ArtifactKind, SessionArtifact } from '@goodboy/types';
import type { CrumbMenuGroup, CrumbMenuModel, CrumbMenuRow } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

export type ArtifactEntry = {
  readonly id: ArtifactId;
  readonly kind: ArtifactKind;
  readonly title: string;
  readonly revision: number;
  readonly updatedAt: string;
  readonly author: string | null;
};

type Params = {
  readonly artifacts: ReadonlyArray<ArtifactEntry>;
  readonly currentId: ArtifactId | null;
  readonly ageOf: (iso: string) => string;
  readonly onSelect: (id: ArtifactId) => void;
};

const KIND_GROUPS: ReadonlyArray<{ readonly kind: ArtifactKind; readonly label: string }> = [
  { kind: 'wireframe', label: 'Wireframes' },
  { kind: 'plan', label: 'Plans' },
  { kind: 'report', label: 'Reports' },
];

const KIND_ICON = {
  wireframe: CONCEPT_ICONS.wireframe,
  plan: CONCEPT_ICONS.plan,
  report: CONCEPT_ICONS.report,
} satisfies Record<ArtifactKind, unknown>;

export const artifactEntryOf = ({
  artifact,
  author,
}: {
  readonly artifact: SessionArtifact;
  readonly author: string | null;
}): ArtifactEntry => ({
  id: artifact.id,
  kind: artifact.kind,
  title: artifact.title,
  revision: artifact.revision,
  updatedAt: artifact.updatedAt,
  author,
});

export const artifactMenu = ({ artifacts, currentId, ageOf, onSelect }: Params): CrumbMenuModel => {
  const rowOf = (entry: ArtifactEntry): CrumbMenuRow => ({
    id: entry.id,
    lead: { kind: 'icon', icon: KIND_ICON[entry.kind] },
    label: entry.title,
    secondary: entry.author,
    metaA: `v${entry.revision} · ${ageOf(entry.updatedAt)}`,
    state: null,
    isCurrent: entry.id === currentId,
    isDisabled: false,
    indent: 0,
    onSelect: () => onSelect(entry.id),
  });
  const groups: ReadonlyArray<CrumbMenuGroup> = KIND_GROUPS.map((group) => ({
    id: group.kind,
    label: group.label,
    rows: artifacts.filter((entry) => entry.kind === group.kind).map(rowOf),
  })).filter((group) => group.rows.length > 0);

  return {
    title: 'Artifacts',
    context: 'this session',
    count: artifacts.length,
    triggerLabel: 'Switch artifact',
    groups,
    actions: [],
    width: 'regular',
    filterPlaceholder: 'Filter artifacts',
  };
};
