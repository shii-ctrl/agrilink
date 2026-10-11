/**
 * Non-sensitive display cache only. Authorization is always verified by the
 * server session cookie and MySQL roles; this cache never contains a password.
 */
const demoSessionKey = "agrilink-session-view";
export const demoSessionEvent = "agrilink-demo-session-changed";

export function setSessionView(account: { username: string; role: string; displayName?: string }) {
  window.localStorage.setItem(demoSessionKey, JSON.stringify(account));
  window.dispatchEvent(new Event(demoSessionEvent));
}

export function clearSessionView() {
  window.localStorage.removeItem(demoSessionKey);
  window.dispatchEvent(new Event(demoSessionEvent));
}

export async function signOutDemoAccount() {
  clearSessionView();
  const { logoutUser } = await import("@/services/auth/auth-functions");
  await logoutUser();
}

export function getDemoAccount() {
  const stored = window.localStorage.getItem(demoSessionKey);
  return stored
    ? (JSON.parse(stored) as { username: string; role: string; displayName?: string })
    : null;
}
