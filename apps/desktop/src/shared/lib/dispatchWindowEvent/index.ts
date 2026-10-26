import type { WindowEventDetails, WindowEventName } from './windowEvents';

type DispatchParams = {
  readonly [Name in WindowEventName]: undefined extends WindowEventDetails[Name]
    ? { readonly name: Name; readonly detail?: WindowEventDetails[Name] }
    : { readonly name: Name; readonly detail: WindowEventDetails[Name] };
}[WindowEventName];

export const dispatchWindowEvent = ({ name, detail }: DispatchParams): void => {
  window.dispatchEvent(
    detail === undefined ? new CustomEvent(name) : new CustomEvent(name, { detail }),
  );
};
