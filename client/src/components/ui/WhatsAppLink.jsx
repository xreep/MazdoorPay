import { MessageCircle } from 'lucide-react';
import { whatsappLink } from '../../lib/whatsapp.js';

// Opens WhatsApp with the message written out; the contractor presses Send there.
export function WhatsAppLink({ phone, message, children, className = '' }) {
  return (
    <a
      href={whatsappLink(phone, message)}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-control border border-[var(--control-border)] bg-surface px-5 font-semibold text-ink transition hover:bg-ink/5 ${className}`}
    >
      <MessageCircle className="h-5 w-5 text-present" aria-hidden="true" />
      {children}
    </a>
  );
}
