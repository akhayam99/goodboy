// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { createPort } from './createPort';

type NameParams = {
  readonly name: string;
};

type NamePort = (params: NameParams) => Promise<string>;

describe('createPort', () => {
  it('holds no port until one is registered', () => {
    expect(createPort<NamePort>().current()).toBeNull();
  });

  it('returns the registered port and forgets it when null is registered', () => {
    const slot = createPort<NamePort>();
    const port: NamePort = async ({ name }) => name;
    slot.register({ port });
    expect(slot.current()).toBe(port);
    slot.register({ port: null });
    expect(slot.current()).toBeNull();
  });

  it('keeps each slot apart', () => {
    const first = createPort<NamePort>();
    const second = createPort<NamePort>();
    first.register({ port: async ({ name }) => name });
    expect(second.current()).toBeNull();
  });
});
