# Brand kit de Kairo

Logos y assets de marca, generados desde `kairo-design-brief.md` (sección _Logo_, líneas 86-111).

**Concepto del ícono:** reloj sin numeración — el momento exacto, no el tiempo que pasa. Manecilla de minutos apunta a las 12 (urgencia), manecilla de horas a las 3.

---

## Qué archivo uso para qué

### Subir a paneles de developer (ML, AliExpress, MercadoPago)

| Panel                        | Archivo recomendado                                     | Por qué                                                                |
| ---------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Mercado Libre DevCenter**  | `kairo-icon-light-256.png` o `kairo-icon-light-512.png` | ML pide cuadrado; el fondo ámbar contrasta sobre el panel blanco de ML |
| **AliExpress Affiliates**    | `kairo-icon-light-512.png`                              | Mismo motivo                                                           |
| **MercadoPago**              | `kairo-icon-light-512.png`                              | Igual                                                                  |
| **Meta Business / WhatsApp** | `kairo-icon-light-512.png`                              | Igual                                                                  |

> **Tip:** si un panel acepta SVG, mejor `kairo-icon-light.svg` (vectorial, escala perfecto). Si solo acepta PNG, los de 512px son el sweet spot.

### Web

| Lugar                    | Archivo                                                         |
| ------------------------ | --------------------------------------------------------------- |
| Favicon principal        | `frontend/public/favicon.svg` (copia de `kairo-icon-light.svg`) |
| Favicon fallback         | `frontend/public/favicon-32.png`                                |
| PWA / mobile home screen | `frontend/public/icon-192.png`                                  |
| OG image / share preview | `frontend/public/icon-512.png`                                  |

### Documentos, emails, presentaciones

| Lugar                                           | Archivo                          |
| ----------------------------------------------- | -------------------------------- |
| Header de email transaccional sobre fondo claro | `kairo-horizontal-light-800.png` |
| Navbar dark / footer dark                       | `kairo-horizontal-dark-800.png`  |
| Texto en línea (firma, mención)                 | `kairo-wordmark-450.png`         |

---

## Inventario completo

### SVGs (fuente, vectorial)

- `kairo-icon-light.svg` — ícono ámbar 512×512
- `kairo-icon-dark.svg` — ícono navy 512×512
- `kairo-horizontal-light.svg` — ícono + wordmark sobre fondo transparente
- `kairo-horizontal-dark.svg` — versión inversa
- `kairo-wordmark.svg` — solo "Kairo" en ámbar

### PNGs

**Íconos cuadrados** (`light` y `dark`):

- `kairo-icon-{light|dark}-512.png` — app icon, OG image, paneles externos
- `kairo-icon-{light|dark}-256.png` — paneles, redes
- `kairo-icon-{light|dark}-192.png` — PWA mobile
- `kairo-icon-{light|dark}-128.png` — apps desktop
- `kairo-icon-{light|dark}-64.png` — UI compacta
- `kairo-icon-{light|dark}-32.png` — favicon

**Horizontales** (ícono + wordmark):

- `kairo-horizontal-{light|dark}-1600.png` — full size
- `kairo-horizontal-{light|dark}-800.png` — uso normal en web
- `kairo-horizontal-{light|dark}-400.png` — header chico, email

**Wordmark suelto:**

- `kairo-wordmark-900.png` / `kairo-wordmark-450.png`

---

## Paleta de marca (ver brief completo)

| Token         | Hex                                                      | Uso                                      |
| ------------- | -------------------------------------------------------- | ---------------------------------------- |
| Ámbar Kairo   | `#BA7517`                                                | Fondo ícono light, CTAs, color principal |
| Crema         | `#FAEEDA`                                                | Reloj sobre ámbar, fondos cards          |
| Navy profundo | `#1a1a2e`                                                | Fondo ícono dark, navbar dark            |
| Wordmark      | `#1a1a2e` sobre fondo claro / `#FAEEDA` sobre fondo dark |                                          |

---

## Cómo regenerar

Si el brief cambia o queremos otro tamaño:

1. Editar el SVG correspondiente
2. Ajustar `.agents/generate-logo.cjs` si hace falta cambiar los tamaños
3. Correr:
   ```powershell
   npm install --no-save sharp        # primera vez si no está
   node .agents/generate-logo.cjs
   ```

Los PNGs se regeneran desde los SVGs con `density: 384` para anti-aliasing limpio.

---

## Notas de tipografía

El wordmark usa **Inter 500** (Google Fonts). Cuando renderiza `sharp` en Windows, si Inter no está instalada en el sistema, cae al fallback (`Segoe UI`, `system-ui`). Visualmente es muy parecido. Si quieres el wordmark exactamente en Inter:

- Instala Inter en tu sistema (Google Fonts → descargar familia → instalar OTFs)
- O exporta el SVG como paths usando Inkscape: `Path > Object to Path` antes de generar PNG

Por ahora la salida es suficiente para uso real (paneles externos, web, emails).
