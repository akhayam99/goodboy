import type { DesignProfile } from './collectDesignProfile';
export const describeDesignProfile = ({ profile }: { readonly profile: DesignProfile }): string => {
  const lines = [`theme name: ${profile.themeName}`, `commit: ${profile.commitSha ?? 'unknown'}`];
  if (profile.tailwind !== null) {
    lines.push(`tailwind config (${profile.tailwind.path}):`, profile.tailwind.excerpt);
  }
  if (profile.tokens.length > 0) {
    lines.push(
      'design tokens:',
      ...profile.tokens.map((token) => `  --${token.name}: ${token.value}  (${token.path})`),
    );
  }
  if (profile.variants.length > 0) {
    lines.push(
      'component variants:',
      ...profile.variants.map(
        (group) => `  ${group.component}: ${group.variants.join(', ')}  (${group.path})`,
      ),
    );
  }
  for (const example of profile.layoutExamples) {
    lines.push(`layout example (${example.path}):`, example.excerpt);
  }
  if (profile.notes.length > 0) {
    lines.push('missing evidence:', ...profile.notes.map((note) => `  ${note}`));
  }
  return lines.join('\n');
};
