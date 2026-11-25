# FLSHD 🇩🇪

App visual para aprender vocabulario alemán con tus propias fotografías, tres etapas de aprendizaje y repetición espaciada.

## Estado actual

La aplicación ya está separada en módulos y funciona como PWA estática.

Implementado:

- Pantalla principal tipo camino de aprendizaje.
- 48 actividades ordenadas de arriba abajo, agrupadas en 8 bloques de 6.
- 3 nodos por fila, tanto en móvil como en escritorio.
- Anillo circular de progreso por tema.
- 800 tarjetas A1 distintas con ID estable, actividad, traducción, artículo, plural cuando corresponde y ejemplo cuando lo aporta la fuente.
- Entrada a cada tema con explicación de las 3 fases.
- Flashcards con fotografía/cámara.
- Relación explícita `wordId ↔ imageId` en IndexedDB.
- Tap para revelar la palabra.
- Swipe derecha = “me la sé”.
- Swipe izquierda = “no la sabía”.
- Punto de artículo: der azul, die rosa, das verde; el texto se revela al tocar.
- Fase de 4 opciones con preguntas de imagen, traducción directa, traducción inversa y artículo.
- Fase de escritura con comparación sin distinguir mayúsculas/minúsculas.
- Una palabra solo se aprende tras una secuencia limpia de las 3 fases.
- Fechas de aprendizaje, último acierto, último fallo y próximo repaso.
- Historial de errores.
- Repasos a 3, 7, 14, 30, 60, 120 y 240 días.
- Tras un fallo: repaso en 1–2 días y reinicio de la escalera.
- Priorización por retraso y fallos de los últimos 7 días.
- Pestañas Aprender, Repasar y Progreso.
- 8 pruebas: una tras cada bloque de 6 actividades, disponibles desde el principio aunque todavía no hayas estudiado el bloque.
- Las pruebas de nivel exigen 0 errores; un fallo termina el intento, pero no hay límite de reintentos.
- Aprobar la prueba es lo único que desbloquea el siguiente bloque; los temas futuros permiten consultar su vocabulario.
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

El currículo A1 completo está repartido en 48 actividades y 800 tarjetas distintas. Consulta [CURRICULUM.md](./CURRICULUM.md) para ver los 8 bloques y el criterio de transformación de la Wortliste.

En modo invitado, las fotos y el progreso se almacenan localmente. Con una cuenta configurada, también se sincronizan con Supabase; cada cuenta tiene una base IndexedDB separada.


## Activar cuentas Supabase

La integración está configurada con Project FLSHD (Supabase). La migración está aplicada y la clave pública está configurada en el frontend.

1. Crea o selecciona un proyecto Supabase dedicado a FLSHD.
2. Ejecuta `supabase/migrations/001_accounts.sql` desde SQL Editor. Activa el proveedor de correo en Authentication; conserva la confirmación de correo y configura SMTP si es necesario.
3. Configura Site URL y Redirect URLs con la URL publicada de FLSHD (incluida la ruta del repositorio).
4. Rellena `src/supabase-config.js` con el Project URL y la clave **publishable** del proyecto (o la clave anon pública heredada). Nunca uses una clave secret/service_role en GitHub Pages.
5. Publica los cambios y prueba dos cuentas diferentes. Verifica que A no pueda leer ni modificar ningún registro de B, que una foto y un repaso se recuperen en otro navegador y que los cambios pendientes sobrevivan a una desconexión.

### Funcionamiento y límites

- Registro por correo y contraseña, confirmación por correo cuando esté habilitada y cierre de sesión.
- Cada cuenta usa su propio IndexedDB, identificado por UUID. El invitado conserva su base original. Desde Mi cuenta se puede importar voluntariamente el progreso y fotos de invitado con IDs compatibles, sin sobrescribir registros ya existentes ni borrar el original.
- Las fotos JPEG comprimidas se guardan en una tabla privada de PostgreSQL como data URLs (límite de carga nuevo: 430 000 caracteres por foto). Esta primera implementación no usa Storage; supervisar la cuota de base de datos antes de crecer.
- Las políticas RLS restringen cada registro a auth.uid(). No hay acceso anónimo.
- Se guardan cambios pendientes localmente y se reintenta enviarlos al guardar, recuperar conexión, iniciar y sincronizar manualmente. Al iniciar o pulsar Sincronizar ahora se descargan los registros de la cuenta. No hay actualización en tiempo real entre sesiones abiertas simultáneamente.
- Los conflictos por palabra o foto se resuelven por fecha de modificación (último cambio); las pruebas aprobadas se combinan. Los contadores de intentos simultáneos no se suman. El primer inicio de sesión requiere internet; el arranque sin internet depende de que el SDK y la sesión estén disponibles en caché.
- El cierre de sesión exige enviar los cambios pendientes. La base local de la cuenta permanece en el navegador: no está cifrada y no es una barrera frente al acceso físico/devtools.
- La caché de la PWA solo guarda recursos estáticos públicos y el SDK público; no respuestas privadas de Supabase.
- Migración y configuración pública aplicadas. RLS y permisos anónimos verificados en la base real; el asesor de seguridad no devuelve avisos. Pendiente: comprobar las URL de redirección de Auth y realizar pruebas de registro, inicio de sesión, aislamiento y sincronización desde dos navegadores reales.
