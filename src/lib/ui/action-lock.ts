type ActionLockListener = () => void;

const listeners = new Set<ActionLockListener>();
let burstLocked = false;
let pendingMutations = 0;
let snapshot: "idle" | "guarded" | "busy" = "idle";
let activeControl: HTMLElement | null = null;

function updateActiveControl() {
  if (pendingMutations > 0 && activeControl?.isConnected) {
    activeControl.setAttribute("data-action-pending", "true");
    activeControl.setAttribute("aria-busy", "true");
    return;
  }
  if (activeControl?.getAttribute("data-action-pending") === "true") {
    activeControl.removeAttribute("data-action-pending");
    activeControl.removeAttribute("aria-busy");
  }
}

function updateSnapshot() {
  updateActiveControl();
  const next = pendingMutations > 0 ? "busy" : burstLocked ? "guarded" : "idle";
  if (next === snapshot) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
  if (next === "idle") activeControl = null;
}

function startClickGuard(control: HTMLElement) {
  activeControl = control;
  burstLocked = true;
  updateSnapshot();
  window.setTimeout(() => {
    burstLocked = false;
    updateSnapshot();
    if (pendingMutations === 0) activeControl = null;
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

    startClickGuard(control);
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
