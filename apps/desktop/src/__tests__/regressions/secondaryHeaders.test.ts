// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');

const SECONDARY_PAGE_FILES: ReadonlyArray<string> = [
  'features/explore/components/ExplorePane/index.tsx',
  'features/companion/components/IphonePage/index.tsx',
  'features/settings/components/SettingsStudio/AppScopePanel.tsx',
  'features/settings/components/SettingsStudio/WorkspaceScopePanel.tsx',
  'features/settings/components/GuideStudio/parts/ChapterPage.tsx',
  'features/changelog/components/ChangelogStudio/CatchUpReader.tsx',
  'features/changelog/components/ChangelogStudio/ReleaseReader.tsx',
  'features/monitoring/components/MonitoringStudio/MonitoringPage.tsx',
  'features/notifications/components/NotificationsStudio/index.tsx',
  'features/impact/components/ImpactStudio/OverviewPanel.tsx',
  'features/impact/components/ImpactStudio/ShippedPanel.tsx',
  'features/impact/components/ImpactStudio/FlowPanel.tsx',
  'features/impact/components/ImpactStudio/SpendPanel.tsx',
];

const TRANSIENT_FLOW_SUBHEADER: Readonly<Record<string, RegExp>> = {
  'features/settings/components/SettingsStudio/WorkspaceScopePanel.tsx':
    /subheader=\{\s*openFlow === null \? undefined : \(\s*<WorkspaceSettingsFlow\b/,
};

const META_LITERAL = /\bmeta=\{?\s*([`"'])((?:\\.|(?!\1).)*)\1/g;

const META_RECORD = /const (?:meta|metaByPage)\b[^=]*=\s*\{([\s\S]*?)\n {2}\};/g;

const STRING_LITERAL = /([`"'])((?:\\.|(?!\1).)*)\1/g;

const SENTENCE = /[.!?]\s*$|[.!?]\s+[A-Z]/;

type Params = {
  readonly source: string;
};

type FileParams = Params & {
  readonly file: string;
};

const withoutSubheaderFlow = ({ file, source }: FileParams): string => {
  const allowed = TRANSIENT_FLOW_SUBHEADER[file];
  return allowed === undefined ? source : source.replace(allowed, '');
};

const metaLiteralsIn = ({ source }: Params): ReadonlyArray<string> => {
  const direct = [...source.matchAll(META_LITERAL)].map((match) => match[2] ?? '');
  const records = [...source.matchAll(META_RECORD)].flatMap((record) =>
    [...(record[1] ?? '').matchAll(STRING_LITERAL)].map((match) => match[2] ?? ''),
  );
  return [...direct, ...records].map((text) => text.replace(/\$\{[^}]*\}/g, '').trim());
};

describe('secondary page headers stay one title and one meta line', () => {
  it.each(SECONDARY_PAGE_FILES)('%s draws no subheader', (file) => {
    const source = withoutSubheaderFlow({
      file,
      source: readFileSync(join(SRC, file), 'utf8'),
    });

    expect(source).not.toMatch(/\bsubheader=/);
  });

  it.each(SECONDARY_PAGE_FILES)('%s writes no sentence in its meta', (file) => {
    const literals = metaLiteralsIn({ source: readFileSync(join(SRC, file), 'utf8') });

    expect(literals.filter((text) => SENTENCE.test(text))).toEqual([]);
  });

  it('spots a sentence in a meta literal', () => {
    const literals = metaLiteralsIn({
      source: 'meta="Every key Goodboy answers to."\nmeta={`${n} shortcuts`}',
    });

    expect(literals.filter((text) => SENTENCE.test(text))).toEqual([
      'Every key Goodboy answers to.',
    ]);
  });

  it('spots a sentence inside a meta record', () => {
    const literals = metaLiteralsIn({
      source:
        "  const meta = {\n    updates: 'Goodboy 1.0',\n    storage: 'Clean up. Then go.',\n  };",
    });

    expect(literals.filter((text) => SENTENCE.test(text))).toEqual(['Clean up. Then go.']);
  });
});
