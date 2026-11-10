// Stable request identifiers for one DEMO checkout selection. No payments or real reservations.
export function createCheckoutState(previous, eventId, typeId, qty, makeRequestId = () => crypto.randomUUID()) {
 const sameSelection = previous?.eventId === eventId && previous.typeId === typeId && previous.qty === qty;
 return {
  eventId,
  typeId,
  qty,
  requestId: sameSelection ? previous.requestId : makeRequestId(),
  submitting: false
 };
}
