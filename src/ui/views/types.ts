import type { DetailMode } from '../../app/store.ts';
import type { Resolved } from '../../csdl/resolve.ts';

/** What every view of an element receives. */
export interface ViewProps<E> {
  resolved: Resolved;
  element: E;
  /** ID of the view's tab, which keys its mode override. */
  tabId: string;
  mode: DetailMode;
}
