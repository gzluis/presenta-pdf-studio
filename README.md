# Presenta PDF — Studio

**Genially + Google Slides publicado → PDF**, desde tu propio equipo, sin subir las diapositivas a un servicio externo.

> **Alcance:** genera un PDF **visual** (imágenes de las diapositivas). No conserva animaciones, enlaces, notas, texto seleccionable o transiciones. La captura automática es heurística y puede necesitar intervención manual.

## Funciones

- Detección automática de Genially y Google Slides publicado en la web.
- Captura automática y captura asistida (navegar, hacer clic y elegir pantallas).
- Espera configurada de **0.3 a 60 segundos**.
- Calidad JPEG 60–95 y límite 10–100 capturas (100 máximo).
- PDF ajustado a la proporción visual de cada captura.
- Monitor de progreso, descarga local y modo oscuro estilo estudio.
- Sin registro, sin cuenta, solo localhost (`127.0.0.1`).

## Requisitos

- Windows 10/11, macOS o Linux.
- Node.js **20 o posterior**.
- Acceso a Internet para instalar dependencias y abrir la presentación pública.

## Iniciar en Windows

1. Descomprime todo el proyecto (no ejecutes desde dentro del ZIP).
2. Ejecuta `INSTALAR_WINDOWS.bat` la primera vez.
3. Ejecuta `INICIAR_WINDOWS.bat`.
4. Abre `http://127.0.0.1:4177`. Mantén la consola del servidor abierta.

## macOS / Linux / Terminal

```bash
npm install
npx playwright install chromium
npm start
```

Abre `http://127.0.0.1:4177`. Para cambiar el puerto define `PORT` en el entorno. Si instalas en Linux sin bibliotecas de Chromium, consulta `npx playwright install --with-deps chromium`.

## Plataformas y enlaces

| Plataforma | Ejemplo admitido |
|---|---|
| Genially | `https://view.genially.com/6acc0de795a03db43812fb3a` |
| Google Slides publicado | `https://docs.google.com/presentation/d/e/2PACX-.../pub?...` |

Un enlace `/edit` o `/present` **no es lo mismo** que un enlace publicado `/pub`. Publica la presentación a la web desde Google Slides si tienes autorización. Los materiales de acceso restringido no se procesan.

## Consejos de captura

- Empieza con 1.6–3 segundos. Usa 5–15 s si hay animaciones o carga lenta.
- Si la captura automática termina antes de tiempo o avanza demasiado, usa el **modo asistido**.
- En Genially con botones, menús o pop-ups, el asistido permite capturar sus distintos estados.
- Cada captura asistida cuenta como una página: evita capturar dos veces la misma pantalla.
- El PDF queda en la carpeta `salidas/` y se ofrece un enlace de descarga.

## Desarrollo

```bash
npm test
npm run check
```

Estructura: `server.js` expone API localhost; `src/validation.js` valida los enlaces; `src/converter.js` maneja Playwright; `src/google-slides.js` captura el lienzo; `src/pdf.js` construye el PDF; `public/` contiene el front-end sin compilación.

## Proyecto en GitHub

Código fuente: https://github.com/gzluis/presenta-pdf-studio

Esta es una **versión beta inicial** (`v2.0.0-beta.1`). Las pruebas locales verifican validación y sintaxis, pero la conversión real depende del comportamiento de los visores públicos y debe probarse en cada entorno. Abre un issue para reportar fallos, con la URL pública de prueba si tienes autorización.

**No se puede alojar la aplicación completa en GitHub Pages**: necesita Node.js y Playwright; GitHub sirve para distribuir el código.

## Limitaciones y licencia

Es una herramienta independiente, no afiliada a Genially ni Google. Úsala con presentaciones que tienes derecho a capturar. MIT. Consulta [SECURITY.md](SECURITY.md) antes de exponer o desplegar el programa.
