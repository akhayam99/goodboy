type Params = {
  readonly view: Window;
};

const guarded = new WeakSet<Window>();

export const guardInertFocus = ({ view }: Params): void => {
  if (guarded.has(view)) {
    return;
  }
  guarded.add(view);
  const nativeFocus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function (this: HTMLElement, options?: FocusOptions): void {
    if (view.frameElement?.hasAttribute('inert') === true) {
      return;
    }
    nativeFocus.call(this, options);
  };
};
