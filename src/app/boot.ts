// On startup the app reopens what the user had: the file named by the URL hash, else the most recent
// one. Until that is settled the start page stays hidden, so it does not flash before the file appears.
import { useEffect, useRef, useState } from 'react';
import { openRecent } from './loader.ts';
import { getRecent, listRecent } from './persistence.ts';
import { parseRoute } from './routing.ts';
import { useStore, type AppDocument } from './store.ts';

/** True until the startup file is open, or it is clear that there is none to open. */
export function useBoot(document: AppDocument | undefined): boolean {
  const [booting, setBooting] = useState(true);
  const started = useRef(false);
  const settled = document?.status === 'ready' || document?.status === 'error';

  useEffect(() => {
    // Effects run twice in development; a file must only be opened once.
    if (started.current) return;
    started.current = true;
    if (useStore.getState().activeId !== undefined) return;
    const route = parseRoute(location.hash);
    // A route is opened by the router; only its file's existence is checked here.
    const find = route ? getRecent(route.docId) : listRecent().then((files) => files[0]);
    void find
      .then((recent) => {
        if (!recent) return undefined;
        return route ? recent.id : openRecent(recent);
      })
      // IndexedDB can be unavailable (e.g. a private window): then there is nothing to reopen.
      .catch(() => undefined)
      .then((id) => id === undefined && setBooting(false));
  }, []);

  // Once a file has been shown, closing it must lead to the start page, not back to loading.
  if (settled && booting) setBooting(false);

  return booting && !settled;
}
