export const verifyIcons = async ({ brands }) => {
  const failures = [];
  for (const brand of brands) {
    const url = `https://cdn.jsdelivr.net/npm/simple-icons@${brand.version}/icons/${brand.slug}.svg`;
    try {
      const svg = await (await fetch(url)).text();
      const path = svg.match(/<path d="([^"]+)"/)?.[1];
      if (path !== brand.path) {
        failures.push(`icons: ${brand.id} does not match ${url}`);
      }
    } catch {
      failures.push(`icons: could not read ${url}`);
    }
  }
  return failures;
};
