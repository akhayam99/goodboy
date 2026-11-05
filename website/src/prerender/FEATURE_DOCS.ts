import featureIndex from '../../../FEATURES.md?raw';

export type FeatureDoc = {
  readonly area: string;
  readonly title: string;
  readonly intro: string;
  readonly headings: readonly string[];
  readonly body: string;
};

const SOURCES = import.meta.glob<string>('../../../docs/features/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const AREA_LINK = /\]\(docs\/features\/([a-z-]+)\.md\)/g;

const plainText = (markdown: string) =>
  markdown
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

const sourceOf = (area: string) => {
  const entry = Object.entries(SOURCES).find(([path]) => path.endsWith(`/${area}.md`));
  if (entry === undefined) {
    throw new Error(`FEATURES.md links docs/features/${area}.md, which does not exist`);
  }
  return entry[1];
};

const toDoc = (area: string): FeatureDoc => {
  const source = sourceOf(area);
  const title = source.match(/^# (.+)$/m)?.[1]?.trim();
  if (title === undefined) {
    throw new Error(`docs/features/${area}.md has no title`);
  }
  const body = source.replace(/^# .+\n/m, '').trim();
  const firstBlock = body.split(/\n\s*\n/)[0] ?? '';
  const isProse = firstBlock !== '' && !/^[#<|]/.test(firstBlock);
  return {
    area,
    title,
    intro: isProse ? plainText(firstBlock) : '',
    headings: [...body.matchAll(/^### (.+)$/gm)].map((match) => plainText(match[1])),
    body: isProse ? body.slice(firstBlock.length).trim() : body,
  };
};

const areas = [...new Set([...featureIndex.matchAll(AREA_LINK)].map((match) => match[1]))];

if (areas.length === 0) {
  throw new Error('FEATURES.md has no "[More on ...]" area links');
}

export const FEATURE_DOCS: readonly FeatureDoc[] = areas.map(toDoc);
