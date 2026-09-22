import type { EvidenceAvailability, EvidenceEntry, EvidenceInventory } from '@goodboy/types';

const AVAILABILITY_LABEL: Readonly<Record<EvidenceAvailability, string>> = {
  delivered: 'delivered in full',
  retrievable: 'retrievable on request',
  truncated: 'truncated, the rest is retrievable',
  unavailable: 'unavailable',
};

const renderEntry = ({ entry }: { readonly entry: EvidenceEntry }): string => {
  const detail = entry.detail === null || entry.detail.length === 0 ? '' : ` ${entry.detail}`;
  return `- \`${entry.sourceId}\` [${entry.kind}] ${entry.label} (from ${entry.provenance}, revision ${entry.revision}, ${AVAILABILITY_LABEL[entry.availability]})${detail}`;
};

export const renderEvidenceInventory = ({
  inventory,
}: {
  readonly inventory: EvidenceInventory;
}): string => {
  const header = `## evidence inventory (revision ${inventory.revision})`;
  if (inventory.entries.length === 0) {
    return [
      header,
      'nothing is on record for you yet. there is nothing more to ask for.',
      `every \`<<need>>\` you emit must carry \`"inventoryRevision": "${inventory.revision}"\`.`,
    ].join('\n');
  }
  const omission =
    inventory.omittedCount > 0
      ? `${inventory.omittedCount} further source(s) exist and are not listed here: ask for them by kind.`
      : 'nothing else exists beyond this list.';
  return [
    header,
    'this is everything on record for you. do not ask for work that produces what is already listed.',
    ...inventory.entries.map((entry) => renderEntry({ entry })),
    omission,
    'retrieve any listed source without spawning an agent: `<<context-read>>{"v":1,"inventoryRevision":"' +
      inventory.revision +
      '","sources":[{"id":"<source id>","range":"<optional range>"}]}<</context-read>>`. the host answers with the content itself.',
    `every \`<<need>>\` you emit must carry \`"inventoryRevision": "${inventory.revision}"\`.`,
  ].join('\n');
};
