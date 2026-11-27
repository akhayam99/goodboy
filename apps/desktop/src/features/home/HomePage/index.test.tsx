// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, it } from 'vitest';
import { HomePage } from './index';

afterEach(cleanup);

describe('HomePage', () => {
  it('names the page Home', () => {
    render(<HomePage />);

    screen.getByRole('heading', { name: 'Home' });
  });
});
