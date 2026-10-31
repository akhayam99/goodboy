import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '..', '..', 'styles.css'), 'utf8');

type UtilityParams = {
  readonly name: string;
};

const utilityBodyOf = ({ name }: UtilityParams): string => {
  const start = css.indexOf(`@utility ${name} {`);
  if (start === -1) {
    throw new Error(`styles.css has no @utility ${name}`);
  }
  return css.slice(start, css.indexOf('\n}', start));
};

describe('the ScrollFade mask utilities', () => {
  it.each(['mask-fade-x', 'mask-fade-y'])(
    '%s resets both fade sizes so a viewport that does not overflow never inherits an outer fade',
    (name) => {
      const body = utilityBodyOf({ name });

      expect(body).toMatch(/--fade-top:\s*0px;/);
      expect(body).toMatch(/--fade-bottom:\s*0px;/);
    },
  );
});
