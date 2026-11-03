// Verificación pública de documentos emitidos: código, dirección y QR. Código compartido por cliente y Worker.
import {qrcodegen} from './vendor/qrcodegen.js';

export const verificationUrl = (origin, code) => `${String(origin).replace(/\/+$/, '')}/v/${code}`;
export const formatCode = code => (String(code).match(/.{1,8}/g) || []).join('-');

/** Código QR como SVG (solo rutas), sin dependencias del navegador. */
export function qrMarkup(text, label = 'Código QR de verificación') {
  const qr = qrcodegen.QrCode.encodeText(text, qrcodegen.QrCode.Ecc.MEDIUM), size = qr.size + 8;
  let path = '';
  for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) if (qr.getModule(x, y)) path += `M${x + 4},${y + 4}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="${label}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}
