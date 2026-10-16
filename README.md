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
- **Subrayados.** Al pasar el cursor por un enlace, el correo, un título de proyecto o un servicio, un hilo corto se dibuja debajo y se recoge al salir. Con `data-yarn-show`, en pantallas táctiles se dibuja al entrar en pantalla. Las palabras cosidas del texto (`.sq`, con `data-color="--lila"` etc.) se cosen con un hilo de su color al entrar en pantalla; al pasar el cursor se descosen y se vuelven a coser.
- **Llamadas a la acción** (`.cta`: «más sobre nudo», «ver todos los proyectos»…). El texto, una costura punteada y una aguja. Al pasar el cursor (en móvil, al entrar en pantalla) el hilo cose la costura hasta el ojo de la aguja.
- **Icono del menú** (móvil). Dos hebras de hilo; al abrir se recogen y se dibujan cruzadas.
- **Ruta.** Entre nudos el hilo no va recto: vaga con un ruido de onda larga (los cruces sobre todo hacia abajo, los márgenes a los lados, en móvil solo hacia dentro). Todas las esquinas de la ruta se redondean con arcos y un seguro quita cualquier vértice que hiciera volver el hilo sobre sí mismo.
- **Nudos.** Están en la línea, no encima: el hilo se hunde un poco, sube por un cruce que queda sobre la misma línea, da la vuelta y vuelve a bajar por ese cruce. Hay cuatro tipos: `loop` (un bucle), `coil` (dos vueltas), `twist` (la punta pasada por dentro del bucle) y `pair` (dos bucles, el segundo más pequeño). Cada nudo lleva una variación propia de tamaño, inclinación, estiramiento y sentido de giro, para que no sean iguales. Se alternan; los nudos con número solo usan `loop` y `coil` para que el número se lea. Se puede fijar uno con `data-knot="twist"`. Al acercarse a un nudo la punta del hilo frena poco a poco y dentro avanza despacio, para verlo formarse. Si el nudo está pegado al margen, el hilo sale en un arco, sin esquina. En cada etiqueta de sección el hilo cruza la página de un margen al otro; un nudo suelto con texto al lado (los pasos apilados en móvil) se rodea sin cruzar. La curva entre puntos es una Catmull-Rom centrípeta, que no se pasa de largo ni hace picos.
- **Siempre a la vista.** El hilo se dibuja por encima del texto; en escritorio también sobre las imágenes a sangre, en pantallas de hasta 900 px por detrás de las imágenes y, si la punta se queda muy atrás por un salto de scroll, salta hasta la pantalla antes de seguir dibujándose.
- **Paleta.** El botón «colores» (abajo a la derecha, `paleta.js`) cambia fondo, tinta y acentos en vivo para decidir la paleta; se guarda en el navegador. Para quitarlo, borrar el archivo y su `<script>` en `src/partials/footer.html`.

Marcado para WordPress: `data-knot` (el hilo hace un nudo alrededor del elemento), `data-yarn-underline` (subrayado al pasar el cursor), `data-logo="hero|footer"`.

## Proyectos

**Miniaturas.** En el inicio, en móvil, los destacados forman una fila que se desliza. Cada proyecto necesita solo dos datos: un color (`--c`) y una imagen. Si la imagen tiene fondo transparente, se usa `.card-media.cutout` (la imagen sobre el bloque de color); si es una foto, `.card-media.photo` (a sangre).

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

Cualquier imagen dentro de `.blocks` (o de un elemento con `data-zoom`) se abre ampliada al hacer clic y respeta su proporción; se pasa de una a otra con las flechas, el teclado o deslizando en móvil.

## Pendiente

- Textos de cada proyecto (los actuales son provisionales)
- Nombres, roles, fotos y texto de «Nosotras»
- Más imágenes de «Carey»
