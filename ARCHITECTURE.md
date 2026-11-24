# Arquitectura de FLSHD

FLSHD es una PWA estática modular. No necesita framework ni servidor para funcionar en GitHub Pages.

## Estructura

```
FLSHD/
├── index.html
├── styles.css
├── manifest.webmanifest
├── sw.js
└── src/
    ├── app.js
    ├── data.js
    ├── db.js
    └── srs.js
```

## Responsabilidades

### `src/data.js`
Define los temas y las palabras. Cada palabra tiene un ID estable:

```js
{
  id: "cocina-kuehlschrank",
  themeId: "cocina",
  german: "Kühlschrank",
  spanish: "nevera",
  article: "der",
  icon: "🧊"
}
```

### `src/db.js`
Gestiona IndexedDB con cuatro almacenes:

- `words`: vocabulario base.
- `images`: imágenes propias. El ID se construye como `img-<wordId>` y también guarda `wordId`.
- `progress`: memoria y aprendizaje por palabra.
- `meta`: reservado para ajustes y migraciones.

La relación foto-palabra queda explícita:

```
word.id = "cocina-kuehlschrank"
image.id = "img-cocina-kuehlschrank"
image.wordId = "cocina-kuehlschrank"
```

### `src/srs.js`
Contiene la planificación de repaso:

- Nueva palabra aprendida: 3 días.
- Aciertos sucesivos: 7, 14, 30, 60, 120 y 240 días.
- Error: 1–2 días y reinicio de la escalera.
- Prioridad: combina retraso, días sin practicar y fallos de los últimos 7 días.

### `src/app.js`
Controla la interfaz y los flujos.

## Flujo de aprendizaje

Una palabra no se considera dominada por pulsar una sola vez “me la sé”.

Para marcarla como aprendida debe completar una secuencia limpia:

1. Flashcard: “me la sé”.
2. Elección: respuesta correcta entre 4 opciones.
3. Escritura: escribe correctamente la palabra.

`learningStep` evoluciona 0 → 1 → 2 → 3. Un error lo devuelve a 0. `bestLearningStep` conserva el progreso visual máximo para que el anillo del tema no retroceda.

Cuando llega a 3:
- `mastered = true`
- se guarda `learnedAt`
- se programa `nextReviewAt` a +3 días.

## Flashcards

- Foto propia o cámara.
- Foto comprimida antes de guardarse.
- Toque de tarjeta: revela/oculta la palabra.
- Swipe derecha: conocida.
- Swipe izquierda: no conocida.
- Código de artículos:
  - `der`: azul.
  - `die`: rosa.
  - `das`: verde.
- El punto muestra el género por color, pero el texto del artículo solo aparece al tocarlo.

## Preguntas

### Fase 2
Alterna:
- significado español → elegir palabra alemana;
- foto → elegir palabra alemana.

Hay cuatro respuestas posibles.

### Fase 3
Muestra foto y significado. El usuario escribe la palabra. Se ignoran mayúsculas/minúsculas y se acepta el sustantivo con o sin artículo.

## Repaso

Solo entran palabras `mastered`. Las vencidas se ordenan por urgencia.

Si una palabra falla durante el repaso:
- se vuelve a añadir al final de la sesión actual;
- se programa nuevamente en 1–2 días;
- el siguiente acierto vuelve al intervalo de 3 días.

## Persistencia

Las fotos y el progreso viven en IndexedDB del navegador. Esto da privacidad y permite una primera versión sin backend, pero no sincroniza entre dispositivos.

Para sincronización futura, la interfaz de `db.js` puede reemplazarse por una API/Supabase/Firebase sin tener que reescribir el flujo pedagógico.
