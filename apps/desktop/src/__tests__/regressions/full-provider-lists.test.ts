// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import ts from 'typescript';
import { isProviderName, PROVIDER_IDS, PROVIDER_NAMES } from '@goodboy/types';
import { describe, expect, it } from 'vitest';
import { PROVIDER_IDS as SPEND_PROVIDER_IDS } from '../../features/budget/components/spend/lib';
import { VALID_PROVIDERS } from '../../features/chat/components/ChatInput/lib';
import { PROVIDER_ORDER } from '../../features/providers/components/ProviderStudio/providerOrder';

const ROOT = resolve(__dirname, '../../../../..');
const SOURCE_ROOTS = [
  'packages/types/src',
  'packages/db/src',
  'packages/core/src',
  'packages/ui/src',
  'apps/desktop/src',
];
const PROVIDER_SET: ReadonlySet<string> = new Set(PROVIDER_IDS);
const PROVIDER_SUBSETS: ReadonlySet<string> = new Set([
  'apps/desktop/src/features/onboarding/OnboardingWizard/agentRowIds.ts#AGENT_ROW_IDS',
  'apps/desktop/src/features/permissions/utils/providerSupport.ts#SUPPORT_COLUMNS',
  'apps/desktop/src/store/slices/providers/refreshProviders.ts#ids',
  'apps/desktop/src/store/slices/turn/planRestartResume.ts#NATIVE_RESUME_PROVIDERS',
  'packages/core/src/providers/autoRouting/defaults.ts#CURATED_PROVIDERS',
  'packages/core/src/providers/limits/selectLimitsChips.ts#LIMITS_CHIP_PROVIDERS',
]);

type WalkParams = { readonly directory: string };

const sourceFiles = ({ directory }: WalkParams): ReadonlyArray<string> =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'test' || entry.name === 'MockScene') {
        return [];
      }
      return sourceFiles({ directory: path });
    }
    return /\.tsx?$/.test(entry.name) && !entry.name.includes('.test.') ? [path] : [];
  });

type NameParams = { readonly node: ts.Node };

const declarationName = ({ node }: NameParams): string => {
  let parent = node.parent;
  while (parent !== undefined) {
    if (ts.isVariableDeclaration(parent)) {
      return parent.name.getText();
    }
    parent = parent.parent;
  }
  return '';
};

type ScanParams = { readonly path: string; readonly text: string };

const incompleteLists = ({ path, text }: ScanParams): ReadonlyArray<string> => {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const failures: Array<string> = [];
  const visit = ({ node }: NameParams): void => {
    if (ts.isArrayLiteralExpression(node)) {
      const ids = node.elements.filter(ts.isStringLiteral).map((element) => element.text);
      const key = `${path}#${declarationName({ node })}`;
      if (
        ids.filter((id) => PROVIDER_SET.has(id)).length >= 4 &&
        ids.length === node.elements.length &&
        !PROVIDER_SUBSETS.has(key) &&
        (ids.length !== PROVIDER_IDS.length || PROVIDER_IDS.some((id) => !ids.includes(id)))
      ) {
        failures.push(key);
      }
    }
    ts.forEachChild(node, (child) => visit({ node: child }));
  };
  visit({ node: source });
  return failures;
};

describe('full provider lists', () => {
  it('uses the registry in the spend view, chat validation and provider order', () => {
    expect(SPEND_PROVIDER_IDS).toBe(PROVIDER_IDS);
    expect(VALID_PROVIDERS).toBe(PROVIDER_IDS);
    expect(PROVIDER_ORDER).toBe(PROVIDER_IDS);
  });

  it('keeps stored provider names open to every registry id and the legacy billing name', () => {
    expect(PROVIDER_NAMES).toEqual([...PROVIDER_IDS, 'openai']);
    expect(PROVIDER_IDS.every((provider) => isProviderName(provider))).toBe(true);
    expect(isProviderName('openai')).toBe(true);
  });

  it('keeps every full TypeScript list equal to the registry, except named capability subsets', () => {
    const files = SOURCE_ROOTS.flatMap((directory) =>
      sourceFiles({ directory: join(ROOT, directory) }),
    );
    expect(
      files.flatMap((path) =>
        incompleteLists({
          path: relative(ROOT, path),
          text: readFileSync(path, 'utf8'),
        }),
      ),
    ).toEqual([]);
  });

  it('detects a stale routing allowlist that omits Copilot', () => {
    expect(
      incompleteLists({
        path: 'packages/db/src/queries/workflowRoutingCodec.ts',
        text: `const PROVIDERS = new Set(${JSON.stringify(PROVIDER_IDS.filter((id) => id !== 'copilot'))});`,
      }),
    ).toEqual(['packages/db/src/queries/workflowRoutingCodec.ts#PROVIDERS']);
  });

  it('detects a complete list that loses a newly registered provider', () => {
    expect(
      incompleteLists({
        path: 'packages/core/src/providers/model-map.ts',
        text: `const PROVIDERS = ${JSON.stringify(PROVIDER_IDS.slice(0, -1))};`,
      }),
    ).toEqual(['packages/core/src/providers/model-map.ts#PROVIDERS']);
  });
});
