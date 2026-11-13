import { useSyncExternalStore } from 'react';

const noop = () => () => {};

/**
 * False in the server HTML and until React has taken over the page, then true. Submit buttons stay disabled until then:
 * a tap before that is sent twice (once by the browser, once replayed by React), which once created duplicate sign-ups.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}
