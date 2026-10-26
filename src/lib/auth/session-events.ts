/**
 * Announces that the browser's authenticated session changed. Components still
 * fetch the account from the server; this only tells them to refresh promptly.
 */
export const authSessionChangedEvent = "agrilink-auth-session-changed";

export function notifyAuthSessionChanged() {
  window.dispatchEvent(new Event(authSessionChangedEvent));
}
