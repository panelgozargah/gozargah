/**
 * Gozargah — embedded QR generation (build-time dependency, bundled into the
 * worker). v1.2 removed the panel's runtime CDN loader for QR — the SVG is
 * now generated server-side; zero external requests at runtime, same as
 * every other asset in the single-file promise.
 */

// qrcode@1.5 ships its own types; keep a local shim for strict builds.
import QR from 'qrcode';

export async function qrSvg(text: string, size = 220, dark = '#0B1020', light = '#FFFFFF'): Promise<string> {
  return QR.toString(text, {
    type: 'svg',
    margin: 1,
    width: size,
    errorCorrectionLevel: 'M',
    color: { dark, light },
  });
}
