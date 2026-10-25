import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { useT } from '../../lib/i18n.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { useScanCard } from './useAttendance.js';

const STATUS_KEY = { present: 'present', 'half-day': 'halfDay', absent: 'absent' };
// The camera sees a card many times a second; the same card within this window counts once.
const SAME_CARD_MS = 4000;

const TONES = {
  ok: { icon: CheckCircle2, className: 'bg-present-soft text-present' },
  info: { icon: Info, className: 'bg-half-soft text-ink' },
  error: { icon: XCircle, className: 'bg-absent-soft text-absent' },
};

// A short beep and buzz, so the supervisor knows a card was read without looking at the screen.
function signal(ok) {
  navigator.vibrate?.(ok ? 80 : [60, 60, 60]);
  const Audio = window.AudioContext ?? window.webkitAudioContext;
  if (!Audio) return;
  const ctx = new Audio();
  const tone = ctx.createOscillator();
  tone.frequency.value = ok ? 880 : 220;
  tone.connect(ctx.destination);
  tone.start();
  tone.stop(ctx.currentTime + 0.12);
  tone.onended = () => ctx.close();
}

// Marks workers present today by scanning their ID cards with the phone camera.
export function ScanDialog({ open, onClose }) {
  const t = useT();
  const videoRef = useRef(null);
  const last = useRef({ code: null, at: 0 });
  const busy = useRef(false);
  const [feedback, setFeedback] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [scans, setScans] = useState([]);
  const scan = useScanCard();
  const scanRef = useRef(scan);
  scanRef.current = scan;

  useEffect(() => {
    if (!open) return undefined;
    let scanner;
    let cancelled = false;

    const onDecode = async ({ data }) => {
      const now = Date.now();
      if (busy.current || (data === last.current.code && now - last.current.at < SAME_CARD_MS))
        return;
      last.current = { code: data, at: now };
      busy.current = true;
      try {
        const res = await scanRef.current.mutateAsync(data);
        const marked = res.result === 'marked';
        setFeedback({
          tone: marked ? 'ok' : 'info',
          text: marked
            ? t('attendance.scanMarked', { name: res.worker.name })
            : t('attendance.scanAlready', {
                name: res.worker.name,
                status: t(`status.${STATUS_KEY[res.status]}`),
              }),
        });
        setScans((list) => [
          { key: `${res.worker._id}-${now}`, name: res.worker.name, marked },
          ...list.filter((s) => s.name !== res.worker.name),
        ]);
        signal(true);
      } catch (err) {
        setFeedback({ tone: 'error', text: err.message });
        signal(false);
      } finally {
        busy.current = false;
      }
    };

    import('qr-scanner').then(async ({ default: QrScanner }) => {
      if (cancelled) return;
      scanner = new QrScanner(videoRef.current, onDecode, {
        preferredCamera: 'environment',
        maxScansPerSecond: 5,
        highlightScanRegion: true,
        returnDetailedScanResult: true,
      });
      try {
        await scanner.start();
      } catch (err) {
        const blocked = err?.name === 'NotAllowedError' || /denied|permission/i.test(String(err));
        setCameraError(blocked ? t('attendance.cameraBlocked') : t('attendance.noCamera'));
      }
    });
    return () => {
      cancelled = true;
      scanner?.stop();
      scanner?.destroy();
    };
  }, [open, t]);

  const tone = feedback && TONES[feedback.tone];
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('attendance.scanTitle')}
      description={t('attendance.scanHint')}
      footer={<Button onClick={onClose}>{t('common.done')}</Button>}
    >
      <div className="space-y-4">
        {cameraError ? (
          <p role="alert" className="rounded-control bg-absent-soft p-4 font-medium text-absent">
            {cameraError}
          </p>
        ) : (
          <div className="overflow-hidden rounded-card bg-ink">
            <video ref={videoRef} muted playsInline className="aspect-square w-full object-cover" />
          </div>
        )}
        {feedback && (
          <p
            role={feedback.tone === 'error' ? 'alert' : 'status'}
            className={`flex items-center gap-2 rounded-control p-3.5 font-semibold ${tone.className}`}
          >
            <tone.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            {feedback.text}
          </p>
        )}
        {scans.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink-muted">
              {t('attendance.scansSoFar')}
            </h3>
            <ul aria-label={t('attendance.scansSoFar')} className="divide-y divide-border">
              {scans.map((s) => (
                <li key={s.key} className="flex items-center justify-between py-2">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-sm text-ink-muted">
                    {s.marked ? t('attendance.scanNew') : t('attendance.scanSeen')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
