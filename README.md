# FLSHD 🇩🇪

App visual para aprender vocabulario alemán con tus propias fotografías, tres etapas de aprendizaje y repetición espaciada.

## Estado actual

La aplicación ya está separada en módulos y funciona como PWA estática.

Implementado:

- Pantalla principal tipo camino de aprendizaje.
- 16 temas ordenados de arriba abajo.
- Máximo de 3 nodos por fila en móvil y 4 en escritorio.
- Anillo circular de progreso por tema.
- 80 palabras iniciales con ID estable, tema, traducción y artículo.
- Entrada a cada tema con explicación de las 3 fases.
- Flashcards con fotografía/cámara.
- Relación explícita `wordId ↔ imageId` en IndexedDB.
- Tap para revelar la palabra.
- Swipe derecha = “me la sé”.
- Swipe izquierda = “no la sabía”.
- Punto de artículo: der azul, die rosa, das verde; el texto se revela al tocar.
- Fase de 4 opciones, alternando significado y fotografía.
- Fase de escritura con comparación sin distinguir mayúsculas/minúsculas.
- Una palabra solo se aprende tras una secuencia limpia de las 3 fases.
- Fechas de aprendizaje, último acierto, último fallo y próximo repaso.
- Historial de errores.
- Repasos a 3, 7, 14, 30, 60, 120 y 240 días.
- Tras un fallo: repaso en 1–2 días y reinicio de la escalera.
- Priorización por retraso y fallos de los últimos 7 días.
- Pestañas Aprender, Repasar y Progreso.
- Pruebas de nivel después de cada bloque de 6 temas.
- Las pruebas de nivel exigen 0 errores; un fallo termina el intento, pero no hay límite de reintentos.
- Los bloques futuros quedan bloqueados hasta superar la prueba anterior; su vocabulario sí se puede consultar.
- Preguntas de reconocimiento variadas: imagen, traducción directa, traducción inversa y artículo.
- Las actividades ocupan el alto de la pantalla y desactivan el scroll; el feedback queda fijado en la parte inferior.
- Feedback pedagógico con corrección, género cuando aplica y ejemplo breve.
- Service worker y manifiesto PWA.

Consulta [ARCHITECTURE.md](./ARCHITECTURE.md) para el modelo de datos y la lógica.

## Ejecutar en local

Los módulos ES necesitan un servidor HTTP. Desde el repositorio:

```bash
python3 -m http.server 8000
```

Después abre:

```
http://localhost:8000
```

## GitHub Pages

Publica la rama `main` desde la raíz del repositorio en Settings → Pages.

Al cambiar versiones puede ser necesario recargar una vez la página para que el service worker sustituya la caché anterior.

## Datos

Actualmente hay 80 palabras de funcionamiento inicial. La arquitectura está preparada para ampliar `src/data.js` al vocabulario A1 completo sin cambiar la base de datos ni las pantallas.

Las fotos y el progreso se almacenan localmente. Borrar los datos del sitio elimina ambos.
