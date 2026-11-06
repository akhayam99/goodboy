// @vitest-environment happy-dom
import { useRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { useDockAskFocus } from '.';

type HarnessProps = {
  readonly askCount: number;
  readonly hasOtherField?: boolean;
};

const Harness = ({ askCount, hasOtherField = false }: HarnessProps) => {
  const dockRef = useRef<HTMLDivElement>(null);
  useDockAskFocus({ dockRef, askCount });
  return (
    <>
      <textarea aria-label="Message in another composer" data-composer-field="" />
      <div data-drop-composer="">
        <div ref={dockRef} />
        <div data-composer-field="">
          <textarea aria-label="Message to the agent" />
        </div>
      </div>
      {hasOtherField ? <input aria-label="Filter" /> : null}
    </>
  );
};

afterEach(() => {
  cleanup();
});

describe('useDockAskFocus', () => {
  it('hands the focus to the field of its own box when an answered ask leaves the dock', () => {
    const view = render(<Harness askCount={1} />);
    expect(document.activeElement).toBe(document.body);

    view.rerender(<Harness askCount={0} />);

    expect(document.activeElement?.getAttribute('aria-label')).toBe('Message to the agent');
  });

  it('leaves the focus alone when an ask arrives', () => {
    const view = render(<Harness askCount={0} />);

    view.rerender(<Harness askCount={1} />);

    expect(document.activeElement).toBe(document.body);
  });

  it('never takes the focus from a field that holds it', () => {
    const view = render(<Harness askCount={1} hasOtherField />);
    const filter = view.getByLabelText('Filter');
    filter.focus();

    view.rerender(<Harness askCount={0} hasOtherField />);

    expect(document.activeElement).toBe(filter);
  });
});
