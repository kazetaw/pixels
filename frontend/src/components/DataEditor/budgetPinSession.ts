// sessionStorage belongs to one browser tab.  This keeps the PIN valid while
// navigating or refreshing that tab, but deliberately asks again in a new tab.
const BUDGET_PIN_SESSION_KEY = 'pixel-budget-pin';

export function getBudgetSessionPin(): string | null {
  try {
    return window.sessionStorage.getItem(BUDGET_PIN_SESSION_KEY);
  } catch {
    return null;
  }
}

export function rememberBudgetSessionPin(pin: string) {
  try {
    window.sessionStorage.setItem(BUDGET_PIN_SESSION_KEY, pin);
  } catch {
    // Private browser modes can disable storage; the current screen still works.
  }
}
