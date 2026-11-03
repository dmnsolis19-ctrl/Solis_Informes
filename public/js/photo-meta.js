// Hora y ubicación opcionales de las fotografías, y dictado a un campo. Lo puro se prueba sin navegador.
import {formatDateTime} from './charts.js';

export const defaultPhotoMeta = {time: true, geo: false};
const geoPattern = /^-?\d{1,3}(\.\d{1,6})?,-?\d{1,3}(\.\d{1,6})?( ±\d{1,5} m)?$/;

export const validTakenAt = value => value === '' || (typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value)));
export const validGeo = value => value === '' || (typeof value === 'string' && value.length <= 40 && geoPattern.test(value));

export function formatGeo(latitude, longitude, accuracy) {
  if (![latitude, longitude].every(Number.isFinite) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return '';
  const base = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  return Number.isFinite(accuracy) && accuracy >= 0 && accuracy < 100000 ? `${base} ±${Math.round(accuracy)} m` : base;
}

/** Momento de captura: usa la fecha del archivo si es de las últimas 24 horas; si no, el momento actual. */
export function captureTime(file, now = Date.now()) {
  const modified = Number(file?.lastModified);
  return new Date(Number.isFinite(modified) && modified <= now + 60000 && now - modified < 86400000 ? modified : now).toISOString();
}

export function locate(timeoutMs = 4000) {
  return new Promise(resolve => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve('');
    navigator.geolocation.getCurrentPosition(p => resolve(formatGeo(p.coords.latitude, p.coords.longitude, p.coords.accuracy)), () => resolve(''), {timeout: timeoutMs, maximumAge: 60000, enableHighAccuracy: false});
  });
}

export async function readPhotoMeta(file, settings = defaultPhotoMeta, now = Date.now()) {
  return {takenAt: settings.time ? captureTime(file, now) : '', geo: settings.geo ? await locate() : ''};
}

/** Línea de texto para el pie de la fotografía en el documento. */
export function photoMetaLine(photo, timeZone = 'America/Santiago') {
  const parts = [];
  const t = Date.parse(photo.takenAt || '');
  if (Number.isFinite(t)) parts.push('Registrada el ' + formatDateTime(t, timeZone));
  if (photo.geo) parts.push('Ubicación: ' + photo.geo);
  return parts.join(' · ');
}

/** Agrega una frase dictada al texto existente cuidando espacios y mayúscula inicial. */
export function appendDictation(existing, phrase) {
  const clean = String(phrase || '').replace(/\s+/g, ' ').trim();
  if (!clean) return existing;
  const base = String(existing || '');
  if (!base.trim()) return clean.charAt(0).toUpperCase() + clean.slice(1);
  const joiner = /[\s\n]$/.test(base) ? '' : ' ';
  const startsSentence = /[.!?]\s*$/.test(base.trimEnd());
  return base + joiner + (startsSentence ? clean.charAt(0).toUpperCase() + clean.slice(1) : clean);
}

export const dictationSupported = () => typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

/** Inicia el reconocimiento de voz del navegador. Devuelve una función para detenerlo. */
export function startDictation({language = 'es-CL', onFinal, onInterim, onEnd, onError}) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) throw new Error('Este navegador no permite dictado. Usa la nota de voz o el dictado del teclado.');
  const recognition = new Recognition();
  recognition.lang = language; recognition.continuous = true; recognition.interimResults = true;
  recognition.onresult = event => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) onFinal?.(result[0].transcript); else interim += result[0].transcript;
    }
    onInterim?.(interim);
  };
  recognition.onerror = event => onError?.(event.error === 'not-allowed' ? 'Permite el micrófono para dictar.' : event.error === 'no-speech' ? '' : 'El dictado se detuvo (' + event.error + ').');
  recognition.onend = () => onEnd?.();
  recognition.start();
  return () => { try { recognition.stop(); } catch {} };
}
