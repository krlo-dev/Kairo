# Kairo — Brief de diseño

Este documento define la identidad visual base de Kairo.
Está pensado para ser entregado a una skill de diseño que lo pula y complete.

---

## Identidad de marca

**Nombre:** Kairo
**Origen del nombre:** Del griego antiguo "kairos" — el momento oportuno, la ventana exacta que no se repite. No el tiempo que pasa, sino el instante que hay que aprovechar.
**Dominio:** kairo.com.co
**Tagline principal:** "El momento exacto para comprar."
**Tagline secundario:** "Rastrea. Compara. Actúa."
**Historia de marca:** "Los griegos tenían dos palabras para el tiempo. Chronos era el tiempo que pasa. Kairo es el momento que no podés dejar escapar. Nosotros te avisamos cuando llega."

---

## Personalidad de marca

- Ambiciosa pero accesible
- Inteligente, no fría
- Directa, sin adornos
- Confiable como un analista
- Latinoamericana de origen, global en aspiración

**Tono de voz:** Datos primero. Frases cortas. Sin exclamaciones innecesarias. Sin emojis en textos formales. El producto habla por sí solo.

**No es:** hiperactiva, informal, vendedora, genérica.
**Sí es:** precisa, oportuna, confiable, moderna.

---

## Paleta de color

### Colores primarios

| Nombre | Hex | Uso |
|---|---|---|
| Ámbar Kairo | `#BA7517` | Color principal de marca, CTAs primarios, logo |
| Ámbar claro | `#EF9F27` | Hover states, acentos, highlights |
| Navy profundo | `#1a1a2e` | Fondos dark, navbar en modo oscuro |
| Crema | `#FAEEDA` | Fondos claros, cards en modo claro |

### Colores secundarios

| Nombre | Hex | Uso |
|---|---|---|
| Ámbar oscuro | `#633806` | Texto sobre fondos claros, iconos |
| Dorado suave | `#FAC775` | Bordes, separadores, elementos decorativos |
| Blanco roto | `#FDFAF5` | Background principal modo claro |
| Gris neutro | `#6B7280` | Texto secundario, labels |

### Colores semánticos (no cambiar)

| Uso | Color |
|---|---|
| Precio bajó / positivo | `#16a34a` (verde) |
| Precio subió / negativo | `#dc2626` (rojo) |
| Alerta activa | `#BA7517` (ámbar Kairo) |
| Info / neutral | `#2563eb` (azul) |

---

## Tipografía

**Fuente principal:** Inter (Google Fonts — gratis)
- Headings: Inter 500 (medium)
- Body: Inter 400 (regular)
- Monospace / precios: Inter 600 tabular nums

**Escala tipográfica:**
```
h1: 36px / 500 / line-height 1.2
h2: 28px / 500 / line-height 1.3
h3: 22px / 500 / line-height 1.4
h4: 18px / 500 / line-height 1.4
body: 15px / 400 / line-height 1.7
small: 13px / 400 / line-height 1.5
label: 11px / 500 / uppercase / tracking 0.06em
precio: 24px / 600 / tabular-nums
```

---

## Logo

**Concepto:** Un reloj sin numeración — el momento exacto, no el tiempo que pasa. Minimalista, reconocible, cargado de significado.

**Composición:** Ícono del reloj + wordmark "Kairo" en Inter 500.

**Variantes requeridas:**
1. Logo completo horizontal (ícono + wordmark) — versión clara
2. Logo completo horizontal (ícono + wordmark) — versión oscura
3. Ícono solo (para favicon, app icon, avatar de redes)
4. Wordmark solo (para uso en texto)

**Especificaciones del ícono:**
- Fondo: cuadrado con bordes redondeados (rx 10)
- Color de fondo: `#BA7517` (versión clara) / `#1a1a2e` (versión oscura)
- Reloj: círculo con manecillas (hora y minutos) sin números
- Color del reloj: `#FAEEDA` sobre ámbar / `#BA7517` sobre navy
- Manecilla de minutos apunta a las 12 (urgencia, el momento exacto)
- Manecilla de horas apunta a las 3
- Punto central pequeño en color matching

**Tamaños a exportar:**
- SVG vectorial (escalable)
- PNG 512x512 (app icon / og image)
- PNG 192x192 (PWA icon)
- ICO 32x32 (favicon)

---

## Componentes UI clave

### Navbar
- Fondo blanco en modo claro / `#1a1a2e` en modo oscuro
- Logo a la izquierda
- Links de navegación centrados o a la derecha
- Botón "Empezar gratis" con fondo `#BA7517` texto `#FAEEDA`
- Altura: 64px
- Sombra sutil: `0 1px 0 rgba(0,0,0,0.08)`

### ProductCard
- Card blanca con borde `0.5px solid #e5e7eb`
- Border radius: 12px
- Padding: 16px
- Imagen del producto: 80x80px, border radius 8px
- Título: 14px / 500 / 2 líneas máximo
- Precio actual: 20px / 600 / `#BA7517`
- Badge de fuente: pill pequeño — "ML" en azul / "AliExpress" en naranja
- Indicador de variación: flecha verde si bajó / roja si subió + porcentaje
- Botón "Seguir": ghost button con borde ámbar

### PriceChart
- Librería: Recharts (LineChart)
- Color de línea: `#BA7517`
- Área bajo la curva: `#FAEEDA` con opacidad 0.4
- Grid: líneas horizontales muy suaves `#f3f4f6`
- Tooltip: card pequeña con precio y fecha
- Sin ejes verticales decorativos — datos limpios
- Puntos en la línea: círculos pequeños `#BA7517`
- Responsive: ocupa el 100% del contenedor

### AlertForm
- Input de precio objetivo con prefijo "$" y moneda
- Toggle email (siempre activo en todos los planes)
- Toggle WhatsApp (deshabilitado y con tooltip "Solo Pro y Comerciante" en plan Free)
- Botón "Crear alerta" con fondo `#BA7517`

### PlanBadge
- FREE: gris claro `#f3f4f6` texto `#6b7280`
- PRO: ámbar claro `#FAEEDA` texto `#633806`
- COMERCIANTE: navy `#1a1a2e` texto `#FAC775`

### Botón CTA principal
```css
background: #BA7517;
color: #FAEEDA;
border-radius: 8px;
padding: 10px 24px;
font-size: 14px;
font-weight: 500;
border: none;
cursor: pointer;
transition: background 0.15s;

&:hover { background: #633806; }
```

### Mensaje de adblock (plan Free)
- Banner sutil en la parte inferior de la pantalla, no intrusivo
- Fondo `#FAEEDA` borde superior `#FAC775`
- Texto: "Usás un bloqueador de anuncios. Los ads nos ayudan a mantener Kairo gratuito. Podés desactivarlo o pasarte a Pro para una experiencia sin anuncios."
- Botón "Ver planes Pro" → link a pricing
- X para cerrar (se guarda en localStorage, no vuelve a aparecer por 7 días)

---

## Layout general — Dashboard

```
┌─────────────────────────────────────────────────────┐
│ NAVBAR: Logo + Nav links + Plan badge + Avatar       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────┐  ┌──────────────────────┐  │
│  │  MIS PRODUCTOS (3)  │  │   ALERTAS ACTIVAS    │  │
│  │  ┌───────────────┐  │  │  · Producto A → $50k │  │
│  │  │  ProductCard  │  │  │  · Producto B → $30k │  │
│  │  └───────────────┘  │  └──────────────────────┘  │
│  │  ┌───────────────┐  │                            │
│  │  │  ProductCard  │  │                            │
│  │  └───────────────┘  │                            │
│  └─────────────────────┘                            │
│                                                     │
│  [AdBanner — solo plan Free]                        │
└─────────────────────────────────────────────────────┘
```

---

## Pantallas a diseñar (en orden de prioridad)

1. **Landing page** — hero, features, pricing, CTA
2. **Dashboard** — lista de productos rastreados
3. **Búsqueda** — resultados unificados ML + AliExpress
4. **Detalle de producto** — historial de precios + crear alerta
5. **Trending** — grid de productos (Pro/Comerciante)
6. **Login / Registro** — formularios simples
7. **Settings** — datos de cuenta, conectar WhatsApp, plan actual
8. **Pricing** — tabla de planes para upgrade

---

## Modo oscuro

Kairo debe soportar modo oscuro nativo (prefers-color-scheme).

| Elemento | Claro | Oscuro |
|---|---|---|
| Background | `#FDFAF5` | `#0f0f1a` |
| Surface / cards | `#FFFFFF` | `#1a1a2e` |
| Border | `#e5e7eb` | `#2d2d3d` |
| Text primary | `#111827` | `#f9fafb` |
| Text secondary | `#6b7280` | `#9ca3af` |
| Ámbar Kairo | `#BA7517` | `#EF9F27` (más brillante en dark) |

---

## Notas para la skill de diseño

- Priorizar limpieza sobre decoración
- Los precios siempre en tabular-nums para alineación
- El gráfico de historial es el elemento visual más importante — debe verse profesional
- Mobile-first: la mayoría de usuarios accederán desde celular
- Evitar el uso de rojo/verde más allá de indicadores de precio
- El ámbar Kairo es el color de la urgencia y la oportunidad — usarlo con criterio, no decorativamente
- Todas las transiciones: 150ms ease
- No usar sombras pesadas — bordes sutiles son suficientes

