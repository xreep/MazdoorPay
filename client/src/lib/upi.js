// A payment request for the contractor's own UPI app, in the standard `upi://pay` format.
// MazdoorPay never sees or moves the money: the contractor pays in their app and types the UTR back.
export function upiPayLink({ upiId, name, amount, note }) {
  const rupees = (amount / 100).toFixed(2);
  // UPI IDs are validated to plain letters, digits and ._-@, which some UPI apps need unescaped.
  return `upi://pay?pa=${upiId}&pn=${encodeURIComponent(name)}&am=${rupees}&cu=INR&tn=${encodeURIComponent(note)}`;
}
