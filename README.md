# gtall — Trading Platform Pro (simulador)

Simulador de **grid bots** y **trading manual** (Spot y Futuros) que corre
íntegramente en el navegador. Usa los endpoints **públicos** de Binance para
precios y velas históricas, y guarda todo el estado en `localStorage`.

> ⚠️ **Esto no opera.** No hay claves de API, no se firma ninguna petición y no
> existe ninguna llamada a `/api/v3/order`. Todas las órdenes, balances y PnL son
> simulados localmente. Es una herramienta para practicar y comparar estrategias
> de rejilla, no un bot de producción.

## Módulos

| Pestaña | Qué hace |
| --- | --- |
| Spot Grid | Rejilla simulada sobre velas reales (aritmética o geométrica), con comisiones y TP/SL |
| Futures Grid | Igual, con apalancamiento y funding estimado |
| Manual Spot / Futures | Abrir/cerrar posiciones a mano con precio en vivo |
| DCA Bot | Compras periódicas simuladas |
| Portfolio | Valoración de posiciones y gráficas |
| Analytics | Métricas agregadas de la actividad local |
| Alerts | Alertas de precio, volumen e indicadores (notificaciones del navegador) |

## Requisitos

- Node.js ≥ 18 (solo para desarrollo; la app es estática)

La app **necesita servirse por HTTP**: carga las pestañas con `fetch()`, así que
abrir `index.html` con doble clic (`file://`) falla por CORS.

## Arrancar

```bash
npm install
npm run dev      # http://localhost:5173
```

Build de producción:

```bash
npm run build    # genera dist/
npm run preview
```

## Tests

```bash
npm test
```

Cubren la lógica pura (niveles, reparto de capital, cruces, comisiones, TP/SL),
el cliente de Binance (caché, deduplicación, reintentos, 429, estado
online/stale) y el esquema de datos (validación, migración, export/import).

## Datos y backups

- Cada registro se guarda versionado: `{ __schema: 2, savedAt, data }`.
- Los registros antiguos (formato plano) se siguen leyendo.
- **💾 Exportar datos** descarga un JSON con todos los conjuntos.
- **⬆️ Importar datos** valida el archivo, migra si hace falta y avisa de claves
  desconocidas antes de sobrescribir.
- El botón de reset ofrece descargar un backup antes de borrar.

## Estructura

```
index.html              cabecera, pestañas y carga de scripts
pages/*.html            contenido de cada pestaña (carga perezosa)
assets/css/main.css     estilos
src/core/grid-math.js   fórmulas puras de la rejilla (módulo ES)
src/core/binance.js     cliente con caché, reintentos y estado de conexión
src/core/storage.js     esquema, validación, migración y export/import
src/core/data-manager.js  persistencia en localStorage y reset
src/core/tab-manager.js   carga de pestañas
src/features/*.js       un archivo por bot/sección
src/main.js             arranque y helpers globales
tests/*.test.js         suite de vitest
```

## Aviso

Los precios vienen de la API pública de Binance y pueden retrasarse o fallar; la
cabecera muestra el estado real (`Precios en vivo` / `Datos retrasados` /
`Sin conexión`). Las comisiones por defecto (0,20 %) y el funding de futuros son
estimaciones, no datos de cuenta.

## Licencia

MIT — ver [LICENSE](LICENSE).
