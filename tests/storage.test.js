import { describe, expect, it, vi } from 'vitest';
import {
  SCHEMA_VERSION,
  STORAGE_KEYS,
  downloadJson,
  migrateImport,
  packExport,
  parseImport,
  stampRecord,
  unwrapRecord,
} from '../src/core/storage.js';

const validExport = () => ({
  schemaVersion: SCHEMA_VERSION,
  app: 'trading-platform-pro',
  exportedAt: '2026-01-01T00:00:00.000Z',
  data: {
    spotGridData: { totalProfit: 12.5 },
    alertsData: { alerts: [{ id: 'a1' }] },
  },
});

describe('registros con esquema', () => {
  it('envuelve y desenvuelve un registro', () => {
    const stamped = stampRecord({ totalProfit: 1 }, Date.UTC(2026, 0, 1));
    expect(stamped.__schema).toBe(SCHEMA_VERSION);
    expect(stamped.savedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(unwrapRecord(stamped)).toEqual({ totalProfit: 1 });
  });

  it('sigue leyendo el formato antiguo sin envoltorio', () => {
    expect(unwrapRecord({ totalProfit: 3 })).toEqual({ totalProfit: 3 });
    expect(unwrapRecord(null, 'por-defecto')).toBe('por-defecto');
  });
});

describe('packExport', () => {
  it('serializa solo las claves presentes', () => {
    const store = {
      spotGridData: JSON.stringify({ totalProfit: 5 }),
      alertsData: '{ "alerts": [] }',
    };
    const payload = packExport(key => store[key] ?? null, { now: Date.UTC(2026, 4, 1) });

    expect(payload.schemaVersion).toBe(SCHEMA_VERSION);
    expect(payload.exportedAt).toBe('2026-05-01T00:00:00.000Z');
    expect(payload.keys.sort()).toEqual(['alertsData', 'spotGridData']);
    expect(payload.missing).toHaveLength(STORAGE_KEYS.length - 2);
    expect(payload.data.spotGridData).toEqual({ totalProfit: 5 });
  });

  it('ignora valores corruptos y los marca como ausentes', () => {
    const payload = packExport(key => (key === 'spotGridData' ? '{no-json' : null));
    expect(payload.keys).toEqual([]);
    expect(payload.missing).toContain('spotGridData');
  });
});

describe('parseImport', () => {
  it('acepta un backup válido', () => {
    const result = parseImport(JSON.stringify(validExport()));
    expect(result.ok).toBe(true);
    expect(result.payload.data.spotGridData).toEqual({ totalProfit: 12.5 });
    expect(result.warnings).toEqual([]);
  });

  it('rechaza vacío, JSON inválido y estructuras incorrectas', () => {
    expect(parseImport('')).toMatchObject({ ok: false, errors: [/vacío/] });
    expect(parseImport('{no json').ok).toBe(false);
    expect(parseImport('[1,2,3]').ok).toBe(false);
    expect(parseImport(JSON.stringify({ schemaVersion: 2 })).errors[0]).toMatch(/data/);
  });

  it('avisa de claves desconocidas y las descarta', () => {
    const payload = validExport();
    payload.data = { ...payload.data, evilKey: { a: 1 } };
    const result = parseImport(JSON.stringify(payload));
    expect(result.ok).toBe(true);
    expect(result.payload.data.evilKey).toBeUndefined();
    expect(result.warnings.join(' ')).toMatch(/evilKey/);
  });

  it('avisa si el backup es de una versión futura', () => {
    const payload = { ...validExport(), schemaVersion: SCHEMA_VERSION + 1 };
    const result = parseImport(JSON.stringify(payload));
    expect(result.ok).toBe(true);
    expect(result.warnings.join(' ')).toMatch(/más nueva/);
  });
});

describe('migrateImport', () => {
  it('inicializa alertsData.alerts al venir de v1', () => {
    const result = migrateImport({ schemaVersion: 1, data: { alertsData: { foo: 1 } } });
    expect(result.data.alertsData).toEqual({ foo: 1, alerts: [] });
    expect(result.migratedFrom).toBe(1);
    expect(result.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('no toca los datos que ya están en v2', () => {
    const data = { alertsData: { alerts: [{ id: 'x' }] } };
    const result = migrateImport({ schemaVersion: 2, data });
    expect(result.data).toEqual(data);
    expect(result.warnings).toEqual([]);
  });
});

describe('downloadJson', () => {
  it('crea un enlace temporal y lo pulsa', () => {
    const click = vi.fn();
    const remove = vi.fn();
    const appendChild = vi.fn();
    const link = { click, remove, set href(v) {}, set download(v) { this._name = v; } };
    const doc = {
      createElement: vi.fn(() => link),
      body: { appendChild },
    };

    globalThis.URL.createObjectURL = vi.fn(() => 'blob:fake');
    globalThis.URL.revokeObjectURL = vi.fn();

    const name = downloadJson({ a: 1 }, 'backup.json', doc);
    expect(name).toBe('backup.json');
    expect(click).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
    expect(appendChild).toHaveBeenCalledWith(link);
  });
});
