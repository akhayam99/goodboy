import { describe, expect, it } from 'vitest';
import { buildWireframeJsonSchema } from './buildWireframeJsonSchema';
import {
  WIREFRAME_BUTTON_VARIANTS,
  WIREFRAME_INPUT_TYPES,
  WIREFRAME_LIMITS,
  WIREFRAME_NODE_KINDS,
  WIREFRAME_VIEWPORTS,
} from './schema';

const schema = buildWireframeJsonSchema();

const text = JSON.stringify(schema);

const at = (path: ReadonlyArray<string>): unknown =>
  path.reduce<unknown>(
    (value, key) =>
      typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined,
    schema,
  );

describe('buildWireframeJsonSchema', () => {
  it('defines every node kind the validator accepts, and only those', () => {
    const refs = at(['$defs', 'node', 'oneOf']);
    expect(refs).toEqual(WIREFRAME_NODE_KINDS.map((kind) => ({ $ref: `#/$defs/${kind}Node` })));
    for (const kind of WIREFRAME_NODE_KINDS) {
      expect(at(['$defs', `${kind}Node`, 'properties', 'kind'])).toEqual({ const: kind });
    }
  });

  it('carries the limits from the code constants', () => {
    expect(at(['properties', 'screens', 'maxItems'])).toBe(WIREFRAME_LIMITS.maxScreens);
    expect(at(['properties', 'transitions', 'maxItems'])).toBe(WIREFRAME_LIMITS.maxTransitions);
    expect(at(['properties', 'mockState', 'maxProperties'])).toBe(
      WIREFRAME_LIMITS.maxMockStateKeys,
    );
    expect(at(['$defs', 'gridNode', 'properties', 'columns', 'maximum'])).toBe(
      WIREFRAME_LIMITS.maxGridColumns,
    );
    expect(text).toContain(`"maxLength":${WIREFRAME_LIMITS.maxTextLength}`);
    expect(text).toContain(`{0,${WIREFRAME_LIMITS.maxIdLength - 1}}`);
    expect(String(at(['description']))).toContain(`${WIREFRAME_LIMITS.maxNodes} nodes`);
  });

  it('lists the enums the validator checks', () => {
    expect(at(['properties', 'screens', 'items', 'properties', 'viewport', 'enum'])).toEqual([
      ...WIREFRAME_VIEWPORTS,
    ]);
    expect(at(['$defs', 'buttonNode', 'properties', 'variant', 'enum'])).toEqual([
      ...WIREFRAME_BUTTON_VARIANTS,
    ]);
    expect(at(['$defs', 'inputNode', 'properties', 'inputType', 'enum'])).toEqual([
      ...WIREFRAME_INPUT_TYPES,
    ]);
  });

  it('requires the fields the validator refuses to guess', () => {
    expect(at(['required'])).toEqual([
      'version',
      'initialScreenId',
      'theme',
      'screens',
      'transitions',
    ]);
    expect(at(['$defs', 'buttonNode', 'required'])).toEqual(['id', 'kind', 'label']);
    expect(at(['$defs', 'stackNode', 'required'])).toEqual(['id', 'kind', 'direction', 'children']);
  });

  it('is plain JSON with a draft 2020-12 header', () => {
    expect(JSON.parse(text)).toEqual(schema);
    expect(schema['$schema']).toBe('https://json-schema.org/draft/2020-12/schema');
  });
});
