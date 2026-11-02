type ActionLockListener = () => void;

const listeners = new Set<ActionLockListener>();
let burstLocked = false;
let pendingMutations = 0;
let snapshot: "idle" | "guarded" | "busy" = "idle";

function updateSnapshot() {
  const next = pendingMutations > 0 ? "busy" : burstLocked ? "guarded" : "idle";
  if (next === snapshot) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function startClickGuard() {
  burstLocked = true;
  updateSnapshot();
  window.setTimeout(() => {
    burstLocked = false;
    updateSnapshot();
  }, 600);
}

/**
 * Prevents a second action control from firing while the first click is being
 * handled. Mutating requests extend the lock until their response completes.
 */
export function installActionClickGuard() {
  const guardClick = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    const control = target?.closest<HTMLElement>('button, [role="button"]');
    if (
      !control ||
      control.closest('[data-action-lock="ignore"]') ||
      control.matches(":disabled") ||
      control.getAttribute("aria-disabled") === "true"
    ) {
      return;
    }

    if (snapshot !== "idle") {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    startClickGuard();
  };

  document.addEventListener("click", guardClick, true);
  return () => document.removeEventListener("click", guardClick, true);
}

export function beginMutatingAction() {
  pendingMutations += 1;
  updateSnapshot();
  let finished = false;

  return () => {
    if (finished) return;
    finished = true;
    pendingMutations = Math.max(0, pendingMutations - 1);
    updateSnapshot();
  };
}

export function subscribeActionLock(listener: ActionLockListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getActionLockSnapshot() {
  return snapshot;
}
