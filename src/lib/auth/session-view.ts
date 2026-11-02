/**
 * Non-sensitive browser display cache. Authorization is always verified by
 * the server session cookie and database roles; this cache is never trusted.
 */
const sessionViewKey = "agrilink-session-view";

// Keep the legacy event value so already-open tabs continue to receive updates.
export const sessionViewChangedEvent = "agrilink-demo-session-changed";

export type SessionView = {
  username: string;
  role: string;
  displayName?: string;
};

export function setSessionView(account: SessionView) {
  window.localStorage.setItem(sessionViewKey, JSON.stringify(account));
  window.dispatchEvent(new Event(sessionViewChangedEvent));
}

export function clearSessionView() {
  window.localStorage.removeItem(sessionViewKey);
  window.dispatchEvent(new Event(sessionViewChangedEvent));
}

export async function signOutCurrentAccount() {
  clearSessionView();
  const { logoutUser } = await import("@/services/auth/auth-functions");
  await logoutUser();
}

export function getSessionView() {
  const stored = window.localStorage.getItem(sessionViewKey);
  return stored ? (JSON.parse(stored) as SessionView) : null;
}
