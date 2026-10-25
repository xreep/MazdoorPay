import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useT } from '../../lib/i18n.jsx';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const PANEL = {
  // Centered dialog on tablet/desktop, bottom sheet on phones.
  dialog: {
    wrap: 'items-end sm:items-center justify-center sm:p-6',
    panel: 'w-full sm:max-w-lg rounded-t-card sm:rounded-card max-h-[92dvh]',
    motion: {
      initial: { y: 24, opacity: 0 },
      animate: { y: 0, opacity: 1 },
      exit: { y: 24, opacity: 0 },
    },
  },
  wide: {
    wrap: 'items-end sm:items-center justify-center sm:p-6',
    panel: 'w-full sm:max-w-3xl rounded-t-card sm:rounded-card max-h-[92dvh]',
    motion: {
      initial: { y: 24, opacity: 0 },
      animate: { y: 0, opacity: 1 },
      exit: { y: 24, opacity: 0 },
    },
  },
  // Bottom sheet on phones, right-hand drawer on desktop.
  drawer: {
    wrap: 'items-end lg:items-stretch justify-end',
    panel: 'w-full lg:max-w-xl rounded-t-card lg:rounded-none max-h-[92dvh] lg:max-h-none lg:h-dvh',
    motion: {
      initial: { y: 32, opacity: 0 },
      animate: { y: 0, opacity: 1 },
      exit: { y: 32, opacity: 0 },
    },
  },
};

export function Modal({ open, onClose, title, description, children, footer, variant = 'dialog' }) {
  const t = useT();
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef(null);
  const bodyRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const restoreTo = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusables = () => [...(panelRef.current?.querySelectorAll(FOCUSABLE) ?? [])];
    const initial =
      bodyRef.current?.querySelector('[data-autofocus]') ??
      bodyRef.current?.querySelector(FOCUSABLE) ??
      focusables()[0];
    initial?.focus();

    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current?.();
      } else if (event.key === 'Tab') {
        const items = focusables();
        if (!items.length) return;
        const first = items[0];
        const last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      if (restoreTo instanceof HTMLElement) restoreTo.focus();
    };
  }, [open]);

  const style = PANEL[variant];
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={`fixed inset-0 z-50 flex ${style.wrap}`}>
          <motion.div
            className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => onClose?.()}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            className={`relative flex flex-col bg-surface shadow-lift ${style.panel}`}
            {...style.motion}
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
          >
            <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-5 sm:px-6">
              <div>
                <h2 id={titleId} className="text-lg font-bold tracking-tight">
                  {title}
                </h2>
                {description && (
                  <p id={descId} className="mt-1 text-sm text-ink-muted">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onClose?.()}
                aria-label={t('common.close')}
                className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-ink/5 hover:text-ink"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-2 sm:px-6">
              {children}
            </div>
            {footer && (
              <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
