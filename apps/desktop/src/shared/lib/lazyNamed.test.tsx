// @vitest-environment happy-dom
import { Suspense } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { lazyNamed } from './lazyNamed';

afterEach(cleanup);

type GreetingProps = {
  readonly name: string;
};

const Greeting = ({ name }: GreetingProps) => <p>Hello {name}</p>;

describe('lazyNamed', () => {
  it('loads the module only when the component renders', async () => {
    const load = vi.fn(() => Promise.resolve({ Greeting, helper: () => 1 }));
    const Lazy = lazyNamed({ load, pick: (module) => module.Greeting });
    expect(load).not.toHaveBeenCalled();
    render(
      <Suspense fallback={<p>Loading</p>}>
        <Lazy name="Harborline" />
      </Suspense>,
    );
    screen.getByText('Loading');
    expect(await screen.findByText('Hello Harborline')).toBeDefined();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('keeps the props of the picked component, whatever else the module exports', async () => {
    const Lazy = lazyNamed({
      load: () => Promise.resolve({ Greeting, count: 3 }),
      pick: (module) => module.Greeting,
    });
    render(
      <Suspense fallback={null}>
        <Lazy name="Northwind" />
      </Suspense>,
    );
    expect(await screen.findByText('Hello Northwind')).toBeDefined();
  });
});
