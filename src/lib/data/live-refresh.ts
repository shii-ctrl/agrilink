import { beginMutatingAction } from "@/lib/ui/action-lock";

export const agrilinkDataChangedEvent = "agrilink:data-changed";
const storageKey = "agrilink:last-data-change";
export const backgroundMutationHeader = "x-agrilink-background";

export function notifyAgrilinkDataChanged() {
  window.dispatchEvent(new Event(agrilinkDataChangedEvent));
  try {
    window.localStorage.setItem(storageKey, String(Date.now()));
  } catch {
    // The same-tab event still refreshes data when storage is unavailable.
  }
}

/**
 * Turns every successful same-origin mutation into one shared refresh signal.
 * Server reads remain untouched, so refresh requests cannot create a loop.
 */
export function installMutationRefreshObserver() {
  const originalFetch = window.fetch;
  const observedFetch: typeof window.fetch = async (input, init) => {
    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    const requestUrl = new URL(
      input instanceof Request ? input.url : String(input),
      window.location.href,
    );
    const requestHeaders = new Headers(input instanceof Request ? input.headers : undefined);
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => requestHeaders.set(key, value));
    }
    const isBackgroundMutation = requestHeaders.get(backgroundMutationHeader) === "true";
    const isMutation =
      requestUrl.origin === window.location.origin &&
      method !== "GET" &&
      method !== "HEAD" &&
      !isBackgroundMutation;
    const finishAction = isMutation ? beginMutatingAction() : null;

    try {
      const response = await originalFetch.call(window, input, init);
      if (response.ok && isMutation) notifyAgrilinkDataChanged();
      return response;
    } finally {
      finishAction?.();
    }
  };

  window.fetch = observedFetch;
  return () => {
    if (window.fetch === observedFetch) window.fetch = originalFetch;
  };
}

export function isAgrilinkDataStorageEvent(event: StorageEvent) {
  return event.key === storageKey;
}
