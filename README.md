# MONTEVAR · OBSIDIANA Nº 01 — Ecommerce 3D inmersivo

Tienda de ropa con experiencia 3D al estilo de los lanzamientos de colección de marcas deportivas. **20 piezas en 4 líneas**: **formal** (blazer, trench, abrigo, jersey de cuello alto, camisa, pantalón sastre, chaleco de tweed, polo de punto), **chaquetas de pista** (cuatro colores), **oversize** (hoodie, camiseta, sobrecamisa, bomber, puffer) y **relojería** (Meridiano 40 en acero, Aurum 38 dorado, Ónix Cronógrafo 42 en cerámica negra).

1. **Marca y menú**: Montevar, sastrería y relojería. Logo en vectores generado con `node scripts/build-logo.mjs` (monograma "M" en Cinzel dentro de un marco doble de latón con rombos de orfebrería, más el nombre con letras espaciadas); archivos en `client/public/brand/` (SVG y PNG de 2400 px). Esquinas rectas y menú con las líneas de la colección (en móvil y tablet, menú a pantalla completa).
1. **Pantalla de carga**: muestra el avance y entra sola al showroom (sin pedir clic). El sonido ambiente arranca apagado y se activa con el botón de la barra.
2. **Showroom 3D (inicio) en rotonda negra**: boiserie de madera ebanizada con molduras de laca negra, arcos con filete de latón satinado, nichos iluminados con lámparas de cuadro de latón y piso de mármol negro pulido. Las prendas destacadas flotan sobre pedestales de piedra negra; en los nichos laterales, percheros de latón con prendas formales colgadas en ganchos (se eligen en la BD con `home_rack`). Un friso de latón con la marca recorre la rotonda.
3. **Recorrido al bajar**: la cámara entra a la rotonda y gira de prenda en prenda (las destacadas) encuadrándola a un lado, mientras un panel editorial (línea, nombre, precio y "Ver en 3D") entra girando en 3D; cierra con un retroceso frontal hacia la galería. En móvil, la prenda arriba y el panel abajo.
4. **Colección debajo del inicio**: al hacer scroll el showroom se desvanece (y su render se pausa) y aparecen banners editoriales por línea, filtros por categoría y la grilla con todas las prendas (al pasar el mouse cada tarjeta cambia a la foto lifestyle).
5. **Transición de cámara**: cada línea abre **su propio mundo** 3D premium — **atelier** para la formal (boiserie de nogal, piso de mármol negro, ventanal con visillos, butaca de cuero, perchero y rollos de tela), **pavilion** para las chaquetas de pista (pabellón de concreto visto con huecos de amarre, ranura vertical de luz teñida con el color de cada chaqueta, muros exentos con luz de luna y pasarela de luz en el piso) y **loft** para la oversize (ventanal de acero con la ciudad de noche, columnas de concreto, banca de travertino, lámpara de arco de latón). Desde el showroom la cámara vuela hacia la prenda; desde la grilla hay un fundido, y al volver se regresa al mismo punto del inicio.
6. **Recorrido con scroll** (Lenis): la cámara se mueve alrededor de la prenda y en cada parada aparece una característica con **efecto glitch**. Para mostrar la espalda la prenda se **balancea con perspectiva mientras el frente se funde con la espalda** (sin girar un plano plano, que se veía como un cuadro).
7. **Final**: texto gigante en movimiento detrás de la prenda (la colección) y el panel de compra con precio, galería y tallas.
8. **Compra por WhatsApp**: talla y carrito lateral persistente (quitar prenda, vaciar carrito); el botón "Comprar por WhatsApp" abre WhatsApp con un mensaje con los datos exactos de cada pieza (nombre, referencia, línea, talla, cantidad, precio unitario, subtotal, enlace) y el total. El número de la tienda se configura en la BD (`whatsapp_number`); si está vacío, WhatsApp deja elegir el contacto. Precios en **pesos colombianos (COP)**.

Las chaquetas son **fotos de producto realistas generadas con IA** (Bing Image Creator), recortadas con un modelo de IA local y montadas en la escena 3D como fotos flotantes con frente y espalda, sombra de contacto y reflejos en el piso. Los escenarios (concreto, grafitis, asfalto) se generan en canvas y el sonido ambiente se sintetiza con Web Audio. La marca "Montevar" es original; no se usan logos de terceros.

### Fotos de producto

- Originales en `design/photos/raw/`, prompts y estado de cada foto en `design/photos/prompts.json`.
- `node scripts/process-photos.mjs` recorta el fondo (frente/espalda) con `@imgly/background-removal-node` (corre local, sin servicios externos) y exporta WebP a `client/public/images/products/<slug>/`.
- Las rutas, textos alternativos y tamaños viven en la tabla `product_images` (seed en `catalog.json`). Para agregar una foto: guárdala en `raw/`, ejecuta el script, añádela al catálogo y corre `npm run db:seed`.
- Si un producto no tiene foto de la espalda, la prenda no gira en el recorrido y el nombre personalizado se imprime en el pecho. La galería, el lookbook y la foto de detalle aparecen solo cuando existen esas fotos.

## Stack

| Capa | Tecnología |
| --- | --- |
| 3D | **Three.js** (r169) + post-procesado bloom con antialiasing MSAA, Reflector para pisos, sombras proyectadas |
| Animación | **GSAP** (transiciones, cámara, UI) + **Lenis** (scroll suave) |
| Frontend | Vite + JavaScript (módulos ES), CSS con tokens; fuentes Anton / Inter / Space Mono (Fontsource, sin CDN) |
| Backend | Node 22 + **Express**, validación con **Zod**, Helmet, rate limit |
| Base de datos | **SQLite nativo de Node** (`node:sqlite`, sin dependencias nativas que compilar) |
| Pruebas | Vitest + Supertest |

## Arquitectura

Backend en **capas** (rutas → controladores → servicios → repositorios → BD). Es un proyecto mediano: las capas separan HTTP, reglas de negocio y SQL sin la ceremonia de una arquitectura hexagonal completa, y la app se construye con inyección de dependencias (`createApp({ db })`) para poder probarla con una BD en memoria.

**Todo el contenido vive en la base de datos**: productos, colores, franjas, mundo 3D de cada producto, características, tallas/stock, textos de la interfaz y el cargo por personalización. Cambiar un precio, un texto o agregar un producto no requiere tocar código (se edita la BD o el seed). Los precios del pedido **siempre se recalculan en el servidor**.

Frontend separado por responsabilidad: `three/` (escenas), `ui/` (DOM), `state/` (carrito puro + store), `api/` (cliente HTTP).

```
ecommerce-3d/
├── client/
│   ├── index.html
│   ├── public/favicon.svg
│   └── src/
│       ├── main.js              # arranque, navegación y transiciones
│       ├── api/client.js        # fetch → { data } / errores tipados
│       ├── state/cart.js        # lógica pura del carrito + store (localStorage)
│       ├── three/
│       │   ├── engine.js        # renderer, bloom, ambiente (mood), cámara amortiguada
│       │   ├── jacket.js        # chaqueta procedural (torno, mangas, franjas, calcomanías)
│       │   ├── showroom.js      # sala principal, hover y selección por raycast
│       │   ├── productStage.js  # mundo del producto + recorrido de cámara por scroll
│       │   ├── marquee.js       # texto gigante personalizable
│       │   ├── floor.js, textures.js
│       │   └── worlds/          # atelier.js, pavilion.js, loft.js
│       ├── ui/                  # carrito, recorrido, sonido, glitch, toast
│       └── styles/main.css      # tokens + componentes + responsive
├── server/
│   ├── index.js / app.js
│   ├── config/env.js
│   ├── routes/ controllers/ services/ repositories/ validators/ middlewares/
│   └── db/
│       ├── migrations/001_init.sql
│       ├── seeds/catalog.json   # datos iniciales (catálogo y textos)
│       ├── migrate.js, seed.js, cli.js
├── tests/server/  tests/client/
└── .env.example
```

## Requisitos

- **Node.js 22.13 o superior** (usa `node:sqlite`). Verificado con Node 22.20.

## Instalar y ejecutar

```bash
npm install
cp .env.example .env      # opcional: los valores por defecto funcionan
npm run dev               # API en :3001 + web en http://localhost:5173
```

La primera vez el servidor crea `data/store.db`, aplica migraciones y carga el seed automáticamente. Comandos de BD:

```bash
npm run db:migrate   # aplica migraciones pendientes
npm run db:seed      # carga/actualiza catálogo y textos (idempotente)
npm run db:reset     # borra la BD y la recrea desde cero
```

Producción (un solo proceso sirve API + sitio compilado):

```bash
npm run build
npm start            # http://localhost:3001
```

## Pruebas y calidad

```bash
npm test     # 35 pruebas
npm run lint
```

Cubren: migraciones 004 y 005 (un mundo premium por línea; el CHECK rechaza mundos desconocidos), catálogo y contenido desde la BD (incluido que un cambio en la BD se refleja sin tocar código), validación 422 por campo, JSON inválido (400), sin stock (409) con **rollback de la transacción**, cálculo de totales y personalización en el servidor, idempotencia de migraciones/seed, lógica del carrito (agrupación, máximos, subtotal, persistencia y datos corruptos) y que **la cámara nunca atraviesa la chaqueta** durante el recorrido.

## Variables de entorno

| Variable | Por defecto | Uso |
| --- | --- | --- |
| `API_PORT` | `3001` | Puerto de la API (Vite redirige `/api` aquí en desarrollo) |
| `DB_PATH` | `./data/store.db` | Archivo SQLite |
| `CORS_ORIGIN` | vacío | Solo si el frontend se sirve desde otro dominio |
| `NODE_ENV` | `development` | |

## API

Respuestas con formato uniforme: éxito `{ "data": ..., "meta"? }`, error `{ "error": { "code", "message", "details"? } }`.

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/health` | Estado |
| GET | `/api/products` | Catálogo activo con colores, mundo, características y disponibilidad de tallas |
| GET | `/api/products/:slug` | Un producto (404 si no existe) |
| GET | `/api/categories` | Líneas de la colección (chaquetas, formal, oversize) |
| GET | `/api/content` | Textos y configuración del sitio |
| POST | `/api/orders` | Crea pedido `{ customer: { name, email }, items: [{ productId, size, quantity, personalization? }] }` → 201 / 422 / 409 |
| GET | `/api/orders/:orderNumber` | Detalle del pedido |

## Accesibilidad y rendimiento

- Selector de productos con botones reales (teclado y lectores de pantalla), foco visible, áreas táctiles de 44 px, `aria-live` en textos dinámicos.
- `prefers-reduced-motion`: transiciones casi instantáneas, scroll sin inercia y texto sin efecto glitch.
- En táctil: primer toque ilumina la chaqueta, segundo la abre. La cámara se aleja en pantallas verticales.
- Pixel ratio limitado a 1.75, mundos pre-construidos durante la carga.

## Pendiente / notas

- **No hay pagos reales**: el pedido se registra en la BD y se muestra confirmación. Integrar una pasarela (p. ej. Stripe en modo de prueba) sería el siguiente paso.
- Las 12 fotos de producto son imágenes generadas por IA (no fotos de un producto fabricado). Si produces las chaquetas, reemplázalas por fotos reales con el mismo flujo (`raw/` → script → catálogo).
- Los enlaces legales del pie apuntan a `#`: faltan las páginas de términos, privacidad y cookies.
- No hay panel de administración: el catálogo se edita en `server/db/seeds/catalog.json` + `npm run db:seed`, o directamente en la BD.
