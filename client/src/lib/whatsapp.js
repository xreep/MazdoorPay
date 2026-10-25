import { formatINR, weekStart } from '@mazdoorpay/shared';

// Click-to-send WhatsApp messages: MazdoorPay only pre-writes the text; the contractor presses
// Send in WhatsApp. Messages are in the worker's language, not the contractor's.

const TEXT = {
  en: {
    locale: 'en-IN',
    hello: (name) => `Namaste ${name},`,
    received: (amount) => `Payment received: ${amount}`,
    type: { wage: 'Wages', advance: 'Advance' },
    method: { cash: 'Cash', upi: 'UPI', bank: 'Bank transfer' },
    reference: { upi: 'UTR', bank: 'Bank ref' },
    receiptNo: (no) => `Receipt no. ${no}`,
    week: (from, to) => `Your work this week (${from} – ${to}):`,
    days: (full, half) => `Full days ${full} · Half days ${half}`,
    money: (earned, paid) => `Earned ${earned} · Paid ${paid}`,
    due: (amount) => `Balance due: ${amount}`,
    advance: (amount) => `Advance still to recover: ${amount}`,
    settled: 'All settled',
    statement: 'See your attendance, wages and payments any time on this link:',
  },
  hi: {
    locale: 'hi-IN',
    hello: (name) => `नमस्ते ${name},`,
    received: (amount) => `आपको ${amount} का भुगतान किया गया`,
    type: { wage: 'मज़दूरी', advance: 'एडवांस' },
    method: { cash: 'नकद', upi: 'UPI', bank: 'बैंक ट्रांसफ़र' },
    reference: { upi: 'UTR', bank: 'बैंक रेफ़' },
    receiptNo: (no) => `रसीद नं. ${no}`,
    week: (from, to) => `इस हफ़्ते का काम (${from} – ${to}):`,
    days: (full, half) => `पूरे दिन ${full} · आधे दिन ${half}`,
    money: (earned, paid) => `कमाई ${earned} · भुगतान ${paid}`,
    due: (amount) => `बाकी: ${amount}`,
    advance: (amount) => `एडवांस बाकी: ${amount}`,
    settled: 'पूरा हिसाब बराबर',
    statement: 'अपनी हाज़िरी, मज़दूरी और भुगतान कभी भी इस लिंक पर देखें:',
  },
};

const textFor = (worker) => TEXT[worker?.preferredLanguage] ?? TEXT.en;

// Business days are IST calendar strings; format them as UTC so the device timezone never shifts them.
const formatDate = (text, day, options) =>
  new Intl.DateTimeFormat(text.locale, { timeZone: 'UTC', ...options }).format(
    new Date(`${day}T00:00:00Z`)
  );

const sum = (rows, pick) => rows.reduce((total, row) => total + pick(row), 0);

export function whatsappLink(phone, message) {
  const chat = phone ? `91${phone}` : '';
  return `https://wa.me/${chat}?text=${encodeURIComponent(message)}`;
}

export function receiptMessage({ payment, worker, contractor }) {
  const text = textFor(worker);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat(text.locale, {
      timeZone: 'UTC',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
      .formatToParts(new Date(`${payment.day}T00:00:00Z`))
      .map((p) => [p.type, p.value])
  );
  const day = `${parts.weekday}, ${parts.day} ${parts.month} ${parts.year}`;
  return [
    text.hello(worker.name),
    text.received(formatINR(payment.amount)),
    `${text.type[payment.type]} · ${text.method[payment.method]} · ${day}`,
    payment.reference && `${text.reference[payment.method] ?? 'Ref'}: ${payment.reference}`,
    text.receiptNo(payment._id.slice(-8).toUpperCase()),
    `— ${contractor.name}`,
  ]
    .filter(Boolean)
    .join('\n');
}

// This week runs Monday to `today`; `balance` is the worker's overall balance, positive when owed.
export function weeklySummaryMessage({
  worker,
  contractorName,
  today,
  attendance,
  payments,
  balance,
}) {
  const text = textFor(worker);
  const from = weekStart(today);
  const thisWeek = ({ day }) => day >= from && day <= today;
  const days = attendance.filter(thisWeek);
  const paid = sum(
    payments.filter((p) => thisWeek(p) && !p.voidedAt),
    (p) => p.amount
  );
  const short = (day) => formatDate(text, day, { day: 'numeric', month: 'short' });
  const owed = balance.balance;
  return [
    text.hello(worker.name),
    text.week(short(from), short(today)),
    text.days(
      days.filter((d) => d.status === 'present').length,
      days.filter((d) => d.status === 'half-day').length
    ),
    text.money(formatINR(sum(days, (d) => d.earned)), formatINR(paid)),
    owed > 0 ? text.due(formatINR(owed)) : owed < 0 ? text.advance(formatINR(-owed)) : text.settled,
    `— ${contractorName}`,
  ].join('\n');
}

export function statementMessage({ worker, url, contractorName }) {
  const text = textFor(worker);
  return [text.hello(worker.name), text.statement, url, `— ${contractorName}`].join('\n');
}
