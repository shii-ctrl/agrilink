/** Refreshes cart indicators after a buyer changes their saved cart. */
export const buyerCartChangedEvent = "agrilink-buyer-cart-changed";

export function notifyBuyerCartChanged() {
  window.dispatchEvent(new Event(buyerCartChangedEvent));
}
