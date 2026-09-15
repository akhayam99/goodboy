export const artifactFileSlug = ({ title }: { readonly title: string }): string => {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug.length === 0 ? 'artifact' : slug;
};
