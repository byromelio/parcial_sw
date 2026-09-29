# Contexto de despliegue — parcial_sw

> Documento para que una sesión nueva de Claude Code (u otro asistente) entienda dónde está desplegado el proyecto, cómo se sube código nuevo, y qué credenciales/configuración tiene la instancia en la nube. Todo lo escrito acá fue verificado contra la instancia real al momento de escribirlo.

## 1. Dónde está desplegado

**Instancia**: AWS EC2, nombre `parcial-sw`.
- Tipo: `c7i-flex.large` (2 vCPU, 4 GB RAM).
- AMI: Ubuntu Server 24.04 LTS (Canonical, sin software adicional).
- Storage: 20 GiB (gp2).
- IP pública: `34.228.23.60` (no es Elastic IP — cambia si se detiene y vuelve a arrancar la instancia; hoy la instancia se deja corriendo, no se detiene).
- Región: `us-east-1`.
- Security Group (`launch-wizard-1`): puertos abiertos a `0.0.0.0/0` — **22** (SSH), **80** (HTTP), **443** (HTTPS). SSH originalmente restringido a "Mi IP", puede necesitar actualizarse si cambia la IP de origen del que se conecta.

**Dominio**: [parcial-sw.duckdns.org](https://parcial-sw.duckdns.org), gestionado en [duckdns.org](https://www.duckdns.org) (cuenta logueada con Google, email `romerrojasrivero...@gmail.com`). Apunta a la IP pública de la instancia de arriba. Si la instancia se reinicia y cambia de IP, hay que entrar a DuckDNS y actualizar el campo "current ip" a mano.

**HTTPS**: certificado de Let's Encrypt (`certbot --standalone`), generado el 22/09/2026, vence el **21/12/2026**. Certbot tiene una tarea programada (`systemd timer`) para renovarlo solo. El certificado vive en `/etc/letsencrypt/` **dentro de la instancia** (no en el repo), y se monta como volumen de solo lectura en el contenedor de nginx.

**Key pair SSH**: `parcial-sw-key.pem`, guardada en `C:\Users\romer\OneDrive\Documentos\Aws\parcial-sw-key.pem` (en la PC local, fuera del repo — nunca subir este archivo a git).

## 2. Cómo conectarse a la instancia

Desde una terminal **PowerShell** (no Git Bash, las rutas de Windows con `\` no funcionan igual):

```powershell
ssh -i "C:\Users\romer\OneDrive\Documentos\Aws\parcial-sw-key.pem" ubuntu@34.228.23.60
```

Una vez conectado, el proyecto está clonado en `~/parcial_sw` (home del usuario `ubuntu`).

## 3. Qué corre en la instancia

Docker Compose, usando **`docker-compose.prod.yml`** (no el `docker-compose.yml` de la raíz, que es para desarrollo local — ver sección 6 sobre por qué están separados):

| Servicio | Contenedor | Expuesto al exterior | Notas |
|---|---|---|---|
| PostgreSQL 16 | `uml-diagramador-db` | No (solo red interna de Docker) | Volumen `pgdata` normal (no externo), datos separados de cualquier base local |
| Backend FastAPI | `uml-diagramador-backend` | No (solo red interna) | Sin puerto publicado al host; nginx es el único que le habla |
| Frontend + nginx | `uml-diagramador-frontend` | Sí — puertos 80 y 443 | Sirve los estáticos de React y hace proxy `/api/` al backend; certificado SSL montado desde `/etc/letsencrypt` del host |

El frontend usa una imagen distinta a la de desarrollo: `frontend/Dockerfile.prod` (con `frontend/nginx.prod.conf`), que fija el `server_name` al dominio DuckDNS y agrega los bloques de HTTPS/redirect. El `Dockerfile` y `nginx.conf` genéricos (sin sufijo `.prod`) siguen siendo los que usa el desarrollo local y no deben tocarse para temas de producción.

## 4. Variables de entorno de la instancia

Archivo `~/parcial_sw/.env` (en la instancia, **no versionado en git**, cubierto por `.gitignore`). Variables que carga (ver `backend/app/core/config.py` para la lista completa que espera el backend):

```
DB_NAME=parcial_sw
DB_USER=postgres
DB_PASSWORD=<definida en la instancia>
JWT_SECRET=<definida en la instancia>
GEMINI_API_KEY=<la misma que se usa en desarrollo local>
CORS_ORIGINS=https://parcial-sw.duckdns.org
SEED_DEMO=false
```

Si hay que cambiar alguna, se edita ese archivo directo en la instancia (`nano .env`) y se reconstruye el backend (ver sección 5).

## 5. Cómo subir cambios de código a la instancia

Flujo estándar, siempre en este orden — **el repo de la instancia nunca se edita a mano**, solo se actualiza vía `git pull`:

### Paso 1 — en tu máquina local (donde programás)
```bash
git add <archivos>
git commit -m "tipo(scope): mensaje en conventional commits"
git push
```

### Paso 2 — conectarse a la instancia
```powershell
ssh -i "C:\Users\romer\OneDrive\Documentos\Aws\parcial-sw-key.pem" ubuntu@34.228.23.60
```

### Paso 3 — en la instancia, traer el código y reconstruir
```bash
cd ~/parcial_sw
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

`docker compose ... up -d --build` reconstruye **solo** las imágenes cuyo Dockerfile o contexto cambió (usa caché de capas de Docker para el resto), así que es seguro correrlo después de cualquier cambio, sin importar si tocaste backend, frontend o ambos.

### Verificar que levantó bien
```bash
docker ps
docker compose -f docker-compose.prod.yml logs backend --tail=50
docker compose -f docker-compose.prod.yml logs frontend --tail=50
```

## 6. Convenciones de commits

- **Conventional commits**: `tipo(scope): descripción corta`, en inglés para el mensaje técnico (`feat`, `fix`, `docs`, `chore`, etc.), siguiendo el estilo que ya tiene el historial del repo (`git log --oneline` muestra el patrón real a seguir).
- **Sin atribución de IA**: nunca agregar líneas tipo `Co-Authored-By: Claude...` a los commits. Es una regla explícita del dueño del proyecto.
- **Nunca commitear secretos**: `.env`, el `.pem` de la key SSH, y cualquier API key van siempre fuera del repo (ver `.gitignore` en la raíz).
- **Config de producción en archivos separados**: cualquier archivo pensado solo para el despliegue en la nube (nginx, Dockerfile, docker-compose) se crea con sufijo `.prod` o en un archivo nuevo (`docker-compose.prod.yml`, `frontend/Dockerfile.prod`, `frontend/nginx.prod.conf`), nunca modificando los que usa el desarrollo local (`docker-compose.yml`, `frontend/Dockerfile`, `frontend/nginx.conf`). Esto evita que un ajuste para el servidor (dominio fijo, certificado SSL que solo existe en la instancia) rompa el flujo de trabajo local.

## 7. Usuarios de la aplicación (para pruebas/demo)

No hay endpoint de registro activo (ver `CONTEXTO_PROYECTO.md`, sección 5) — los usuarios se crean a mano con un `INSERT` directo a la base, generando el hash de la contraseña con la propia función del backend:

```bash
docker compose -f docker-compose.prod.yml exec backend python3 -c \
  "from app.core.security import hash_password; print(hash_password('la-contraseña'))"
```

Y después:
```bash
docker compose -f docker-compose.prod.yml exec db psql -U postgres -d parcial_sw -c \
  "INSERT INTO \"user\" (email, name, password_hash, role, active) VALUES ('correo@ejemplo.com', 'Nombre', '<hash generado arriba>', 'admin', true);"
```

Usuarios ya creados en la instancia (contraseña `Examen2026x` para ambos):
- `admin@parcial.com` (rol `admin`)
- `colaborador@parcial.com` (rol `editor`)

## 8. Backend Spring Boot generado (aparte, solo local)

El backend que exporta el diagramador (`POST /diagrams/{id}/export-download`) **no se despliega en la nube** — se descarga como `.zip`, se descomprime en la PC local (por ejemplo en `generated_backend/`, carpeta ignorada por git) y se levanta con su propio `docker-compose.yml` en el puerto 8090, separado del diagramador (que usa 8000/5433 en desarrollo o queda todo detrás de nginx en producción). Esto es así para poder correr ambos (diagramador + backend exportado) a la vez sin conflicto de puertos, y porque cada backend generado corresponde a un diagrama distinto según lo que se exporte ese día.

## 9. Problemas conocidos de esta configuración

- **La IP pública no es fija**: si se detiene la instancia (no solo se reinicia el SO, sino "Stop" desde la consola de AWS), la IP cambia y hay que actualizar DuckDNS a mano. Mientras la instancia se deje corriendo, no pasa.
- **El certificado vive solo en la instancia**: si se recrea la instancia desde cero, hay que volver a correr `certbot certonly --standalone` (con el contenedor de frontend detenido momentáneamente para liberar el puerto 80).
- **`docker-compose.prod.yml` no trackea cambios en `.env` automáticamente**: después de editar `.env` en la instancia, hay que reconstruir con `--build` para que el backend tome las nuevas variables (los contenedores no releen `.env` en caliente).

## 10. Incidente del 26-27/09/2026: contenedores de dev pisaron los de producción

Durante una sesión de debugging de import/export XMI se corrió varias veces
`docker compose build backend` / `docker compose up -d backend` **sin** el
flag `-f docker-compose.prod.yml`, confiando en que el archivo por defecto
(`docker-compose.yml`, el de desarrollo) bastaba. Como ambos compose usan los
mismos nombres de contenedor (`uml-diagramador-backend`,
`uml-diagramador-frontend`, `uml-diagramador-db`), Docker Compose reemplazó
silenciosamente los contenedores de producción por las versiones de
desarrollo: el frontend volvió a publicar `5173:80` sin HTTPS en vez de
`80:443` con el nginx+certbot de `Dockerfile.prod`, y el sitio público
empezó a devolver `ERR_CONNECTION_REFUSED` (nada escuchando en 80/443:
`sudo ss -tlnp | grep -E ':443|:80'` daba vacío). No hubo ningún error
visible en el momento del `build`/`up` — el build y el arranque del
contenedor de dev fueron exitosos, solo que era el compose equivocado.

**Lección**: la sección 3/5/10 de este documento ya advertía usar siempre
`-f docker-compose.prod.yml` en la instancia, pero en el fragor de un
debugging puntual (enfocado en un bug de backend, no en el despliegue en
sí) se corrieron comandos de memoria sin releer este archivo primero. Antes
de tocar Docker en el EC2, releer este documento — en particular, **nunca
correr `docker compose build/up/down/logs` en la instancia sin
`-f docker-compose.prod.yml` explícito**, ni siquiera "solo para probar
algo rápido".

También se confirmó que verificar "el rebuild tomó el código nuevo" solo
por el `build` sin error NO alcanza: hace falta `docker exec
<contenedor> grep <patrón-del-cambio> <archivo>` para confirmar que el
contenedor que quedó corriendo realmente tiene el código nuevo adentro. En
un caso puntual de esta sesión, un `build` exitoso quedó sin efecto porque
el `up -d` fallaba después por un volumen externo no encontrado
(`PG_VOLUME_NAME`, ver más abajo) — el contenedor viejo seguía corriendo y
nada lo avisaba salvo revisar el contenido real dentro del contenedor.

### Nombre del volumen de Postgres: solo relevante para desarrollo local

El `docker-compose.yml` de **desarrollo** (no el `.prod.yml`) tenía el
nombre del volumen externo de Postgres hardcodeado con el hash autogenerado
del entorno local de quien lo escribió originalmente. Se parametrizó con
`PG_VOLUME_NAME` (default a ese hash) más la clave lógica `pgdata:` +
`name: ${PG_VOLUME_NAME:-...}` en la sección `volumes:` top-level — Compose
no permite interpolar variables directo en el *nombre de la clave* de un
volumen, pero sí en su propiedad `name`. Esto **no afecta a
`docker-compose.prod.yml`**, que ya declaraba el volumen simplemente como
`pgdata:` sin ser `external`, así que no necesita ninguna variable extra.

## 11. Reglas para futuras sesiones

- No asumir que la instancia sigue arriba sin verificarlo (`curl -s -o /dev/null -w "%{http_code}" https://parcial-sw.duckdns.org`) antes de dar por hecho que "todo funciona".
- No editar código directo en la instancia vía SSH — siempre local → commit → push → pull en la instancia → rebuild. La única excepción son operaciones puntuales de datos (crear un usuario, un `INSERT` de prueba), nunca cambios de código fuente.
- Si se cambia algo del pipeline de `exporters/` (lo que genera el backend Spring Boot), no hace falta redesplegar la instancia del diagramador — ese cambio solo afecta al próximo backend que se exporte, no a nada que ya esté corriendo.
- Antes de dar instrucciones de "correr esto en tu terminal", confirmar si el usuario está en la terminal SSH (instancia) o en su terminal local — son entornos distintos y los comandos no son intercambiables (rutas, `sudo`, disponibilidad de `flutter`/`docker`, etc.).
- **Todo comando `docker compose` en la instancia lleva `-f docker-compose.prod.yml` explícito, sin excepción** — ni para "probar algo rápido". Confundirse de archivo no tira ningún error, solo reemplaza en silencio los contenedores de producción por los de desarrollo (ver sección 10).
- Un `docker compose build` sin errores no prueba que el rebuild se aplicó: si el `up -d` posterior falla (por ejemplo por un volumen externo no encontrado) el contenedor viejo sigue corriendo. La forma confiable de verificar es `docker exec <contenedor> grep <algo-del-cambio-nuevo> <archivo>` sobre el contenedor ya corriendo, no solo mirar que `build` haya terminado bien.
- Si el sitio público empieza a dar `ERR_CONNECTION_REFUSED`, antes de sospechar de DNS o del código, correr `sudo ss -tlnp | grep -E ':443|:80'` en la instancia: si no hay nada escuchando ahí, es casi seguro que se corrió Docker Compose sin `-f docker-compose.prod.yml` y se pisó el nginx con HTTPS.
