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
    expect(isChatWorkStage('started')).toBe(true);
    expect(isChatWorkStage('back')).toBe(true);
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

  it('waits for a disabled button instead of spending its step on it', async () => {
    const onClick = vi.fn();
    mount('<button id="start" disabled>Start work</button>');
    const start = document.getElementById('start');
    start?.addEventListener('click', onClick);

    const stop = driveChatWork({ stage: 'drawer' });
    expect(onClick).not.toHaveBeenCalled();

    start?.removeAttribute('disabled');
    await vi.waitFor(() => expect(onClick).toHaveBeenCalledTimes(1));
    stop();
  });

  it('leaves a control that is already open or selected alone', () => {
    const onStart = vi.fn();
    const onTab = vi.fn();
    const onSession = vi.fn();
    mount(`
      <button id="start" aria-expanded="true">Start work</button>
      <div role="tab" id="tab" aria-selected="true">Add to a session</div>
      <div role="combobox" aria-label="Session" id="session" aria-expanded="false"></div>
    `);
    document.getElementById('start')?.addEventListener('click', onStart);
    document.getElementById('tab')?.addEventListener('click', onTab);
    document.getElementById('session')?.addEventListener('click', onSession);

    const stop = driveChatWork({ stage: 'session' });

    expect(onStart).not.toHaveBeenCalled();
    expect(onTab).not.toHaveBeenCalled();
    expect(onSession).toHaveBeenCalledTimes(1);
    stop();
  });

  it('clicks each control once even when the driver starts twice', async () => {
    const onStart = vi.fn((event: Event) => {
      const target = event.currentTarget;
      if (target instanceof HTMLElement) {
        target.setAttribute('aria-expanded', 'true');
      }
    });
    mount('<button id="start">Start work</button>');
    document.getElementById('start')?.addEventListener('click', onStart);

    const first = driveChatWork({ stage: 'drawer' });
    first();
    const second = driveChatWork({ stage: 'drawer' });
    mount('<i></i>');
    await Promise.resolve();

    expect(onStart).toHaveBeenCalledTimes(1);
    second();
  });

  it('starts the session once the brief is ready for the started stage', async () => {
    const clicked: string[] = [];
    mount('<button id="start">Start work</button>');
    document.getElementById('start')?.addEventListener('click', () => {
      clicked.push('start work');
      mount('<button id="go" disabled>Start session</button>');
      document.getElementById('go')?.addEventListener('click', () => clicked.push('start session'));
    });

    const stop = driveChatWork({ stage: 'started' });
    expect(clicked).toEqual(['start work']);

    document.getElementById('go')?.removeAttribute('disabled');
    await vi.waitFor(() => expect(clicked).toEqual(['start work', 'start session']));
    stop();
  });

  it('goes back only after the new session is showing', async () => {
    const clicked: string[] = [];
    mount('<button id="start">Start work</button>');
    document.getElementById('start')?.addEventListener('click', () => {
      clicked.push('start work');
      mount('<button id="go">Start session</button>');
      document.getElementById('go')?.addEventListener('click', () => {
        clicked.push('start session');
        document.body.innerHTML = '<button aria-label="Back to Chat" id="back">Back</button>';
        document.getElementById('back')?.addEventListener('click', () => clicked.push('back'));
      });
    });

    const stop = driveChatWork({ stage: 'back' });
    await vi.waitFor(() => expect(clicked).toEqual(['start work', 'start session']));
    expect(clicked).not.toContain('back');

    mount('<div data-scene-view="session"></div>');
    await vi.waitFor(() => expect(clicked).toEqual(['start work', 'start session', 'back']));
    stop();
  });
});
