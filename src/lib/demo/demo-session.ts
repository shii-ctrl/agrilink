// Compatibility exports for isolated demo helpers. Production code imports
// the neutral session-view module directly.
export {
  clearSessionView,
  getSessionView as getDemoAccount,
  sessionViewChangedEvent as demoSessionEvent,
  setSessionView,
  signOutCurrentAccount as signOutDemoAccount,
} from "@/lib/auth/session-view";
