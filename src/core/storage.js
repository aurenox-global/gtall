/**
 * storage.js — esquema, versionado y export/import de los datos locales.
 *
 * No toca localStorage por sí mismo: recibe/entrega objetos y deja que
 * DataManager (script clásico) hable con el almacenamiento. Así la lógica de
 * migración y validación se puede testear sin navegador.
 */

export const SCHEMA_VERSION = 2;

export const STORAGE_KEYS = [
  'manualSpotData',
  'manualFuturesData',
  'spotGridData',
  'futuresGridData',
  'dcaBotData',
  'alertsData',
  'portfolioData',
  'analyticsData',
];

const isPlainObject = value =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Envuelve un registro con la versión de esquema y la fecha de guardado. */
export function stampRecord(record, now = Date.now()) {
  return {
    __schema: SCHEMA_VERSION,
    savedAt: new Date(now).toISOString(),
    data: record,
  };
}

/**
 * Desenvuelve un registro guardado. Acepta el formato antiguo (objeto plano)
 * para no romper los datos que ya tenga el usuario en el navegador.
 */
export function unwrapRecord(parsed, defaultValue = null) {
  if (parsed === null || parsed === undefined) return defaultValue;
  if (isPlainObject(parsed) && '__schema' in parsed && 'data' in parsed) {
    return parsed.data ?? defaultValue;
  }
  return parsed;
}

/**
 * Construye el paquete de exportación.
 * @param {(key: string) => string|null} read  lector de un valor crudo
 */
export function packExport(read, { keys = STORAGE_KEYS, now = Date.now() } = {}) {
  const data = {};
  const found = [];
  const missing = [];

  for (const key of keys) {
    const raw = read(key);
    if (raw === null || raw === undefined) {
      missing.push(key);
      continue;
    }
    try {
      data[key] = JSON.parse(raw);
      found.push(key);
    } catch (err) {
      missing.push(key);
    }
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    app: 'trading-platform-pro',
    exportedAt: new Date(now).toISOString(),
    keys: found,
    missing,
    data,
  };
}

const isSerializable = value => {
  if (value === null) return true;
  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean') return Number.isFinite(value) || type !== 'number';
  if (type === 'object') {
    if (Array.isArray(value)) return value.every(isSerializable);
    return Object.values(value).every(isSerializable);
  }
  return false;
};

/**
 * Valida y normaliza un JSON de importación.
 * @returns {{ok: boolean, errors: string[], payload: object|null, warnings: string[]}}
 */
export function parseImport(text, { keys = STORAGE_KEYS } = {}) {
  const errors = [];
  const warnings = [];
  let payload;

  if (typeof text !== 'string' || text.trim() === '') {
    return { ok: false, errors: ['El archivo está vacío'], payload: null, warnings };
  }

  try {
    payload = JSON.parse(text);
  } catch (err) {
    return { ok: false, errors: ['El archivo no es JSON válido'], payload: null, warnings };
  }

  if (!isPlainObject(payload)) {
    return { ok: false, errors: ['El JSON debe ser un objeto'], payload: null, warnings };
  }
  if (!isPlainObject(payload.data)) {
    return { ok: false, errors: ['Falta la propiedad "data"'], payload: null, warnings };
  }

  const entries = {};
  for (const [key, value] of Object.entries(payload.data)) {
    if (!keys.includes(key)) {
      warnings.push(`Clave desconocida ignorada: ${key}`);
      continue;
    }
    if (!isSerializable(value)) {
      warnings.push(`Valor no válido ignorado en ${key}`);
      continue;
    }
    entries[key] = value;
  }

  if (Object.keys(entries).length === 0) {
    return { ok: false, errors: ['No hay datos reconocibles que importar'], payload: null, warnings };
  }

  const version = Number(payload.schemaVersion) || 1;
  if (version > SCHEMA_VERSION) {
    warnings.push(
      `El archivo es de una versión más nueva (v${version} > v${SCHEMA_VERSION}); puede haber datos que se ignoren`
    );
  }

  return {
    ok: true,
    errors,
    warnings,
    payload: { ...payload, schemaVersion: version, data: entries },
  };
}

/**
 * Migra un paquete ya validado a la versión actual del esquema.
 * De momento v1→v2 solo garantiza que existan los contenedores esperados.
 */
export function migrateImport(payload) {
  const version = Number(payload?.schemaVersion) || 1;
  const data = { ...(payload?.data || {}) };
  const warnings = [];

  if (version < 2) {
    if (data.alertsData && !Array.isArray(data.alertsData.alerts)) {
      data.alertsData = { ...data.alertsData, alerts: [] };
      warnings.push('v1→v2: se inicializó alertsData.alerts');
    }
  }

  return { data, schemaVersion: SCHEMA_VERSION, migratedFrom: version, warnings };
}

/** Descarga un objeto como JSON (solo navegador). */
export function downloadJson(payload, filename = `gtall-backup-${new Date().toISOString().slice(0, 10)}.json`, doc = typeof document !== 'undefined' ? document : null) {
  if (!doc) throw new Error('downloadJson requiere un documento');
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = doc.createElement('a');
  link.href = url;
  link.download = filename;
  doc.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}

export const StorageSchema = {
  SCHEMA_VERSION,
  STORAGE_KEYS,
  stampRecord,
  unwrapRecord,
  packExport,
  parseImport,
  migrateImport,
  downloadJson,
};

if (typeof window !== 'undefined') {
  window.StorageSchema = StorageSchema;
}
