// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { driveChatWork, isChatWorkStage } from './driveChatWork';

afterEach(() => {
  document.body.innerHTML = '';
});

const mount = (html: string): void => {
  document.body.insertAdjacentHTML('beforeend', html);
};

describe('driveChatWork', () => {
  it('knows the stages a scene URL may ask for', () => {
    expect(isChatWorkStage('project')).toBe(true);
    expect(isChatWorkStage('popover')).toBe(false);
    expect(isChatWorkStage(null)).toBe(false);
  });

  it('clicks each control in order as it shows up', async () => {
    const clicked: string[] = [];
    mount('<button id="start">Start work</button>');
    document.getElementById('start')?.addEventListener('click', () => {
      clicked.push('start');
      mount('<div role="combobox" aria-label="Project" id="project"></div>');
      document.getElementById('project')?.addEventListener('click', () => clicked.push('project'));
    });

    const stop = driveChatWork({ stage: 'project' });
    await vi.waitFor(() => expect(clicked).toEqual(['start', 'project']));
    stop();
  });
});
