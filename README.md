# nudo — laboratorio de creación editorial

Sitio de nudo. HTML, CSS y JS sin dependencias. Pensado para pasarse después a WordPress.

Publicado con GitHub Pages desde `docs/`.

## Estructura

```
src/
  partials/   head, header y footer comunes
  pages/      una página por archivo (inicio, proyectos, un archivo por proyecto, sobre nudo, servicios, contacto)
build.py      arma docs/ a partir de src/
docs/         el sitio publicado
  styles.css
  yarn.js     el sistema de hilo
  main.js     menú, tarjetas, visor de imágenes, círculo de palabras
  assets/     imágenes optimizadas, videos y fuentes
```

Cada página de `src/pages/` empieza con unas líneas de datos (`title`, `desc`, `nav`) y después del `---` va el contenido. Para regenerar el sitio:

```bash
python3 build.py
```

Para verlo en local:

```bash
cd docs && python3 -m http.server 8765
```

## El hilo (`yarn.js`)

Todo lo que es hilo en la página se dibuja, nunca se estira. Hay un solo trazo (una base en vino y las hebras claras cruzadas) y una sola animación: la longitud dibujada crece.

- **Logo.** La foto del hilo se revela a lo largo de un trazado dibujado a mano sobre cada letra, en el orden en que se escribiría. Al tocarlo se deshace y se vuelve a dibujar.
- **Hilo de la página.** Un solo hilo nace en la cola de la «o» del logo, baja por el margen, hace un nudo en cada etiqueta de sección y en los pasos del proceso, y termina dibujando el logo del pie. Se dibuja con el scroll.
- **Subrayados.** Al pasar el cursor por un enlace, un título de proyecto o un servicio, un hilo corto se dibuja debajo y se recoge al salir.
- **Nudos.** Son trocoides (el bucle que hace un hilo al avanzar y girar), así que entran y salen con la misma tangente que el resto de la línea.

Marcado para WordPress: `data-knot` (el hilo hace un nudo alrededor del elemento), `data-pass` (pasa por su borde), `data-yarn-underline` (subrayado al pasar el cursor), `data-logo="hero|footer"`.

## Proyectos

**Miniaturas.** Cada proyecto necesita solo dos datos: un color (`--c`) y una imagen. Si la imagen tiene fondo transparente, se usa `.card-media.cutout` (la imagen sobre el bloque de color); si es una foto, `.card-media.photo` (a sangre).

**Páginas de proyecto.** Se arman con bloques, como una entrada, y cada proyecto tiene su propia disposición. Equivalen a bloques de WordPress:

| clase | qué es |
|---|---|
| `.b-text` | párrafos (`.center` para centrarlos) |
| `.b-full` | imagen o video a todo el ancho (`.bleed` sale del margen) |
| `.b-row` | fila de imágenes con la misma altura; conviven verticales, cuadradas y panorámicas |
| `.b-cols` | texto e imagen en dos columnas (`.rev` invierte el orden) |
| `.b-grid` | rejilla de `--n` columnas (`.square` recorta a cuadrado) |
| `.b-pair` | dos imágenes (`.offset` baja la segunda) |
| `.b-quote` | cita grande |
| `.b-sticker` | imagen recortada sobre un bloque de color |

Cualquier imagen dentro de `.blocks` se abre ampliada al hacer clic y respeta su proporción.

## Pendiente

- Textos de cada proyecto (los actuales son provisionales)
- Nombres, roles, fotos y texto de «Nosotras»
- Imágenes de «El mundo de las setas» y más imágenes de «Carey»
