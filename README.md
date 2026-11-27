# Mi Comunicación CAA (PWA para iPadOS)

Aplicación Web Progresiva (PWA) de **Comunicación Aumentativa y Alternativa (CAA)** de baja distracción, diseñada para niños autistas de 4 años en **iPad (orientación horizontal/landscape)** y 100% persistente en **Firebase Firestore (Plan gratuito Spark, $0 sin usar Firebase Storage)**.

---

## Características Clave

- **Baja distracción clínica:** Fondo `#F8FAFC`, tarjetas blancas `rounded-3xl`, clave de color **Fitzgerald modificada** (naranja sustantivos/comidas, amarillo personas, verde verbos, azul colores/adjetivos, morado lugares), cero confeti, cero puntos y cero sonidos de error (Modo Modelado).
- **Audio híbrido universal (Windows Chrome ↔ iPadOS Safari):**
  - Usa por defecto la voz en español del iPad (**0 KB**) con blindaje WebKit (antirrebote de 150 ms, pausa de 60 ms tras `cancel()`, retención anti-GC y watchdog timeout) y `navigator.audioSession.type = 'playback'` para ignorar el Modo Silencio en iPadOS 17+.
  - Permite grabar voz propia (codificada en el cliente a **MP3 mono 48 kbps** con `@breezystack/lamejs`, nunca `.webm`) o subir `.mp3`/`.m4a` (`< 150 KB`) para sonidos reales de animales o voz familiar.
  - Barra de frase inteligente (`[Sujeto] + [Verbo] + [Opción]`) con iluminación secuencial y soporte de concordancia gramatical natural (`spokenLabel`, ej. muestra `"selva"`, dice `"la selva"`).
- **100% Offline y Anti-Límite 1 MiB:** Metadatos separados de binarios (`media/{id}` `< 150 KB`), caché persistente de Firestore (`persistentLocalCache`) + caché dedicada en **IndexedDB** con pre-descarga silenciosa en Wi-Fi y limpieza automática de archivos huérfanos.
- **Candado infantil de 3 segundos:** Ícono discreto en la esquina superior derecha (`opacity-30`) que exige mantener presionado 3 segundos continuos para abrir el panel de edición.

---

## 1. Requisitos Locales

- [Node.js LTS](https://nodejs.org/) (v20 o superior)

```bash
npm install
cp .env.example .env
# Edita .env con tus credenciales de Firebase (paso 2)
npm run dev
```

---

## 2. Configurar Firebase Gratis (Plan Spark — $0)

### Paso A: Crear el proyecto y Firestore
1. Ingresa a [Firebase Console](https://console.firebase.google.com/) y haz clic en **Agregar proyecto**.
2. Ponle un nombre (ej. `mi-comunicacion-caa`), desactiva Google Analytics (no es necesario) y crea el proyecto.
3. En el menú lateral ve a **Compilación → Firestore Database** → **Crear base de datos**.
4. Elige una ubicación cercana (ej. `southamerica-east1` o `us-central1`) e inicia en **modo producción**.
5. **No actives Firebase Storage** (no se usa; las fotos y audios comprimidos `< 150 KB` se guardan de forma aislada en la colección `media` de Firestore).

### Paso B: Obtener credenciales para `.env`
1. Ve a **Configuración del proyecto** (ícono de engranaje arriba a la izquierda) → pestaña **General**.
2. En **Tus apps**, haz clic en el ícono web (`</>`), ponle un apodo (ej. `caa-pwa`) y registra la app.
3. Copia los 4 valores de `firebaseConfig` en tu archivo `.env` local (basado en `.env.example`):
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_APP_ID`

### Paso C: Crear el usuario administrador único (Firebase Auth)
1. En el menú lateral ve a **Compilación → Authentication** → **Comenzar**.
2. En **Proveedores de acceso**, activa únicamente **Correo electrónico/contraseña** (desactiva el enlace sin contraseña) y guarda.
3. Ve a la pestaña **Usuarios** → **Agregar usuario**.
4. Crea tu correo y contraseña de padre/administrador. *(La app no tiene pantalla pública de registro).*

### Paso D: Pegar las Reglas de Seguridad de Firestore
1. Ve a **Firestore Database → Reglas**.
2. Reemplaza todo el contenido por el archivo `firestore.rules` incluido en este proyecto y haz clic en **Publicar**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

---

## 3. Desplegar Gratis en Vercel

1. Sube este proyecto a un repositorio privado o público en GitHub.
2. Inicia sesión en [Vercel](https://vercel.com/) → **Add New → Project** y selecciona tu repositorio.
3. Framework Preset: **Vite** (detectado automáticamente).
4. En **Environment Variables**, agrega las 4 variables de tu `.env`:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_APP_ID`
5. Haz clic en **Deploy**. Vercel te dará una URL HTTPS permanente (ej. `https://mi-caa.vercel.app`), requisito indispensable para grabar micrófono e instalar la PWA en iPadOS.

---

## 4. Instalar en el iPad (Safari iPadOS) y Primer Uso

1. Abre tu URL de Vercel en **Safari** del iPad (en posición horizontal).
2. Toca el botón **Compartir** (cuadrado con flecha hacia arriba) → **Agregar a inicio** → **Agregar**.
3. Abre la app desde el nuevo ícono de la pantalla de inicio (se abrirá a pantalla completa sin barras de Safari).
4. Mantén presionado el **candado discreto** en la esquina superior derecha durante **3 segundos continuos** e inicia sesión con tu usuario administrador.
5. Ve a la pestaña **Ajustes y Respaldo** y presiona **"Cargar ejemplos iniciales"** para poblar *Animales* y *Familia* al instante.
6. Presiona **"Probar voz y diagnóstico"** para confirmar la voz en español del iPad. *(Consejo: en Ajustes del iPad → Accesibilidad → Contenido leído → Voces → Español, puedes descargar gratis una voz mejorada como **Paulina** o **Mónica** para un habla aún más natural).*
7. Cuando termines de editar, presiona **"Bloquear y volver al juego"** para cerrar sesión y entregar el iPad con seguridad.
