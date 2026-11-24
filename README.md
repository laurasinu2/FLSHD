# FLSHD 🇩🇪

Prototipo web para aprender vocabulario alemán A1 mediante tus propias fotografías, tarjetas y repetición espaciada.

## Funcionalidades implementadas
- Portada móvil con **16 temas**, hasta **3 círculos por fila** y progreso alrededor.
- **80 palabras iniciales de demostración**, cada una con un identificador estable `tema-número`, traducción, artículo y emoji.
- En cada flashcard puedes **hacer una foto o subir una imagen**. Se comprime antes de guardarse, y se asocia a la palabra.
- Tocar la tarjeta revela la palabra; deslizamiento derecha/izquierda o botones para indicar si la conocías.
- Punto de color del artículo: **der = azul, die = rosa, das = verde**; el artículo se revela tocando el punto.
- Fase 2: reconocimiento por **cuatro opciones**, alternando traducción y fotografía.
- Fase 3: **escribir la respuesta** mostrada en imagen, ignorando mayúsculas/minúsculas; se pide el sustantivo sin artículo.
- Una palabra se considera aprendida al superar las tres fases; los fallos reinician su progresión.
- Pestaña de repaso con intervalos **3, 7, 14, 30, 60, 120, 240 días** tras los aciertos y **1 día** tras un error.
- Prioridad de repaso calculada con retraso acumulado y fallos de los últimos siete días.
- Fechas del último éxito, fallo, aprendizaje y vencimiento, además del historial reciente de fallos.

## Cómo usar
Abre `index.html` en un servidor web estático, por ejemplo con `python3 -m http.server 8000` desde la carpeta del repositorio, y entra en `http://localhost:8000`. También puede publicarse en GitHub Pages (Settings → Pages → Deploy from a branch → main / root).

En móvil, abre la dirección publicada por HTTPS y usa «Añadir a pantalla de inicio» para un acceso directo. No se ha implementado todavía un service worker ni soporte offline completo.

## Persistencia y privacidad
La app usa **IndexedDB del navegador**: almacenes `records` (estado por palabra) y `photos` (imagen comprimida asociada al ID de la palabra). Las fotos **no salen del dispositivo**. No hay servidor, cuenta, autenticación ni sincronización. Si borras los datos del sitio o cambias de navegador/dispositivo, perderás el progreso y las fotos. No utilices modo incógnito.

## Pendiente para una versión completa
- Importar y revisar **todo el vocabulario de la lista A1 del Goethe**, no solo estas 80 palabras de ejemplo, y añadir plural y ejemplos.
- Soportar cuentas, base de datos sincronizada, almacenamiento seguro de imágenes y exportación/copia de seguridad.
- Mejorar la planificación del repaso con un algoritmo adaptativo como FSRS y validación de tasa de recuerdo, frente a los intervalos fijos actuales.
- Añadir pruebas automatizadas, accesibilidad ampliada, feedback de rendimiento y despliegue automatizado.
- Añadir evaluación del artículo y plural; por ahora **el artículo no se evalúa** en la fase de escritura.
- Fotos por defecto para los objetos sin imagen subida; ahora se muestra un emoji.

Este proyecto usa un diseño original inspirado en el patrón visual de caminos de aprendizaje, sin copiar recursos gráficos de otras marcas.
