import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { STAGE_GRADIENT_TOKEN } from '../constants.mjs';
import { SOURCE_DIRECTORY, WEBSITE_DIRECTORY } from '../paths.mjs';

const MASK_PROPERTY = /^(-webkit-)?mask(-|$)/;
const GRADIENT = /(?:repeating-)?(?:linear|radial|conic)-gradient\(/g;

const sourceFiles = ({ directory }) =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      return sourceFiles({ directory: path });
    }
    return /\.(css|tsx?)$/.test(name) ? [path] : [];
  });

export const checkGradients = () => {
  const failures = [];
  sourceFiles({ directory: SOURCE_DIRECTORY }).forEach((file) => {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(GRADIENT)) {
      const before = source.slice(0, match.index);
      const declarationStart = Math.max(
        before.lastIndexOf(';'),
        before.lastIndexOf('{'),
        before.lastIndexOf('}'),
      );
      const declaration = before.slice(declarationStart + 1);
      const property = declaration.split(':')[0].trim();
      const blockStart = before.lastIndexOf('{');
      const blockEnd = source.indexOf('}', match.index);
      const block = blockStart === -1 || blockEnd === -1 ? '' : source.slice(blockStart, blockEnd);
      const isMasked = block.split(';').some((line) =>
        MASK_PROPERTY.test(
          line
            .replace(/^[\s{]*/, '')
            .split(':')[0]
            .trim(),
        ),
      );
      const isAllowed =
        property === STAGE_GRADIENT_TOKEN || MASK_PROPERTY.test(property) || isMasked;
      if (!isAllowed) {
        const line = before.split('\n').length;
        failures.push(
          `gradients: ${file.slice(WEBSITE_DIRECTORY.length + 1)}:${line} paints a gradient through "${property}"; only ${STAGE_GRADIENT_TOKEN} and mask rings may`,
        );
      }
    }
  });
  const definitions = sourceFiles({ directory: SOURCE_DIRECTORY }).filter((file) =>
    new RegExp(`${STAGE_GRADIENT_TOKEN}:\\s*(linear|radial|conic)-gradient`).test(
      readFileSync(file, 'utf8'),
    ),
  );
  if (definitions.length !== 1) {
    failures.push(
      `gradients: ${STAGE_GRADIENT_TOKEN} must be defined exactly once, found ${definitions.length}`,
    );
  }
  return failures;
};
