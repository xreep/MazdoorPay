import { useMemo } from 'react';
import { qrcode } from 'qrcode-generator';

const QUIET_ZONE = 4;

// A QR code drawn as one SVG path, black on white so any phone camera reads it in either theme.
export default function QrCode({ value, label, size = 176 }) {
  const { count, path } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let row = 0; row < n; row++)
      for (let col = 0; col < n; col++) if (qr.isDark(row, col)) d += `M${col},${row}h1v1h-1z`;
    return { count: n, path: d };
  }, [value]);
  const box = count + QUIET_ZONE * 2;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`${-QUIET_ZONE} ${-QUIET_ZONE} ${box} ${box}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className="shrink-0 rounded-lg"
    >
      <rect x={-QUIET_ZONE} y={-QUIET_ZONE} width={box} height={box} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
