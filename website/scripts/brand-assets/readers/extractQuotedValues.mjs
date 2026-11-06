export const extractQuotedValues = ({ source, description }) => {
  const values = [...source.matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]);
  if (values.length > 0) {
    return values;
  }
  throw new Error(`Could not find literal members for ${description}`);
};
