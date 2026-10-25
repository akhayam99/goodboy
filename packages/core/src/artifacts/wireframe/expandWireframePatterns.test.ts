import { describe, expect, it } from 'vitest';
import { expandWireframePatterns } from './expandWireframePatterns';

const rootOf = (value: unknown): object => {
  const screens: unknown =
    typeof value === 'object' && value !== null ? Reflect.get(value, 'screens') : null;
  const first: unknown = Array.isArray(screens) ? screens[0] : null;
  const root: unknown =
    typeof first === 'object' && first !== null ? Reflect.get(first, 'root') : null;
  if (typeof root !== 'object' || root === null) {
    throw new Error('expected a screen root');
  }
  return root;
};

describe('expandWireframePatterns with a __proto__ key', () => {
  it('keeps the key as data and never rewires the prototype of an expanded node', () => {
    const value: unknown = JSON.parse(`{
      "patterns": {
        "row": { "id": "row", "kind": "text", "text": "x", "__proto__": { "polluted": true } }
      },
      "screens": [{ "id": "home", "root": { "use": "row", "id": "first" } }]
    }`);
    const result = expandWireframePatterns({ value });
    if (result.status !== 'expanded') {
      throw new Error('expected an expansion');
    }
    const root = rootOf(result.value);
    expect(Reflect.get(root, 'polluted')).toBeUndefined();
    expect(Object.getPrototypeOf(root)).toBe(Object.prototype);
    expect(Reflect.get(root, 'id')).toBe('first');
  });
});
