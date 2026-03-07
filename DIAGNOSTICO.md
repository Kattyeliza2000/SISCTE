# Diagnóstico - Botón de Google No Funciona

## Cambios realizados:

1. **Mejorada la función `login()`:**
   - Agregado logging detallado en consola
   - Mejor manejo de errores
   - Agregadas scopes de perfil y email

2. **Mejorada la función `initFirebase()`:**
   - Logging de cada paso de inicialización
   - Manejo de errores con try-catch
   - Desbloquea incluso si hay error

3. **Expuestas todas las funciones globales:**
   - `login`, `loginEmail`, `registrarEmail`, `olvidoContrasena`
   - `ir`, `show`, `hide`, `toast`, `$`
   - Y todas las demás funciones del sistema

## Pasos para verificar si funciona:

### 1. Abre la Consola del Navegador (F12):
   - Ve a la pestaña "Console"

### 2. Verifica que veas estos mensajes:
```
Iniciando Firebase...
Firebase modules cargados, inicializando app...
Firebase inicializado correctamente
```

### 3. Haz clic en el botón "Acceder con Google" y verifica:
```
Login iniciado...
Firebase listo, iniciando autenticación de Google...
Intentando popup de Google...
Abriendo ventana de Google...
```

## Posibles problemas:

### Si ves "auth/popup-blocked":
- El navegador bloqueó el popup
- El sistema automáticamente usará redirect a Google
- Aparecerá el mensaje: "Redirigiendo a Google (popup bloqueado)..."

### Si ves errores de CORS o red:
- Problema de GitHub Pages + Firebase
- Solución temporal: prueba en `localhost` o un servidor propio
- O configura CORS en Firebase Storage (ver comentario en app.js líneas 11-31)

### Si ves "Firebase inicializado correctamente" pero no funciona el botón:
- Revisa que los eventos de click estén asignados (línea 430)
- Abre la consola y escribe: `login()` para llamar manualmente
- Revisa los mensajes de error en la consola

## Configuración importante:

- **Firebase Project ID:** siscte-30f1b
- **AuthDomain:** siscte-30f1b.firebaseapp.com
- **Google Client ID:** 270864419518-qi6hia7bu9012til3b0fhn13tct81feu.apps.googleusercontent.com

## Testing rápido desde la consola:

Abre la consola (F12) y ejecuta estos comandos:

```javascript
// Ver si Firebase está inicializado
console.log(window._fb)

// Ver el estado del usuario actual
console.log(usuario)

// Llamar login manualmente
login()

// Ver si auth existe
console.log(auth)
```

## Resumen de cambios en archivos:

- **app.js:** Mejorada función `login()`, `initFirebase()`, expuestas todas las funciones
- **index.html:** Sin cambios (botón sigue igual, ahora funciona via addEventListener)
- **styles.css:** Sin cambios
