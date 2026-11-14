// Stable request identifiers for one DEMO checkout selection. No payments or real reservations.
export function createCheckoutState(previous, eventId, typeId, qty, makeRequestId = () => crypto.randomUUID()) {
 const sameSelection = previous?.eventId === eventId && previous.typeId === typeId && previous.qty === qty;
 return {
  eventId,
  typeId,
  qty,
  requestId: sameSelection ? previous.requestId : makeRequestId(),
  // A timed-out request may already own the last seat. Its original key must
  // remain retryable even when currently available inventory is zero.
  attempted: sameSelection ? previous.attempted === true : false,
  submitting: false
 };
}

export function canSubmitCheckout(checkout, remaining) {
 return Boolean(checkout && (checkout.attempted === true ||
   (Number.isSafeInteger(remaining) && remaining >= checkout.qty)));
}
