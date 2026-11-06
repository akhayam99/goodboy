export const extractIconPath = ({ iconSource, componentName }) => {
  const declaration = `export const ${componentName}:`;
  const declarationIndex = iconSource.indexOf(declaration);
  if (declarationIndex === -1) {
    throw new Error(`Could not find ${componentName} in the app brand icons`);
  }
  const blockEnd = iconSource.indexOf(`${componentName}.displayName`, declarationIndex);
  if (blockEnd === -1) {
    throw new Error(`Could not find the end of ${componentName} in the app brand icons`);
  }
  const block = iconSource.slice(declarationIndex, blockEnd);
  const paths = [...block.matchAll(/<path\s+d=["']([^"']+)["']\s*\/>/g)].map((match) => match[1]);
  if (paths.length === 0) {
    throw new Error(`Could not find path data for ${componentName} in the app brand icons`);
  }
  return paths.join(' ');
};
