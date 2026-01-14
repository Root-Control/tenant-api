# Cursor Prompt — Implementar Login Handler (Hub Identity) con JIT + WorkOS + PKCE (Stage 3)

Contexto real (NO inventar campos):

- Ya existe handler **pre_session** (GET) funcionando y guardando `auth_pre_sessions` + cookie `PRESESSION_COOKIE_NAME`.
- Ya existen modelos y helpers:
  - `AuthUser`, `AuthMembership`, `PreSession`, `AuthCode`, `AuthSession`
  - `normalize_email()`
  - `consume_pre_session(psid)` (atómico, single-use)
  - `create_auth_code(pre_session, user_id, membership_id, ttl)`
  - `create_auth_session(user_id, active_tenant_id, active_membership_id, ttl, ip, ua)`
- Collections existentes / obligatorias:
  - `auth_users`, `auth_memberships`, `auth_pre_sessions`, `auth_codes`, `auth_sessions`
- Stage1 mirror existente:
  - `auth_tenant`, `auth_clients`, `auth_domains`, etc. (pre_session ya usa Domain+Client; reutiliza la misma resolución).

Objetivo:
Implementar el handler **login** (actualmente hello world) en Rust para Hub Identity.

---

## 0) Reglas duras (no negociar)

1. Body del login: **SOLO** `{ "email": "...", "password": "..." }`
   - No agregar `pre_session_id` al body.
   - El `psid` SIEMPRE viene en cookie (`PRESESSION_COOKIE_NAME`).

2. No inventar nuevos campos en modelos:
   - `auth_memberships` NO tiene roles/scopes/source.
   - `auth_users` NO tiene legacy_user_id (eso va en memberships como `tenant_user_id`).

3. Cookies:
   - Determinar Secure **solo** por `ENV`:
     - `ENV=local` => Secure=false
     - `ENV=dev|prod` => Secure=true
   - Nombres de cookies vienen de env:
     - `PRESESSION_COOKIE_NAME`
     - `HUB_SESSION_COOKIE_NAME`

4. Pre-session y auth_code: single-use + TTL. Si se reusa, debe fallar.

5. JIT se decide por memberships (NO migrations):
   - Si existe membership para `{user_id, tenant_id}` => rama WorkOS.
   - Si NO existe => rama Tenant password-check.

---

## 1) Variables de entorno (todas obligatorias)

- `ENV` = local|dev|prod
- `PRESESSION_COOKIE_NAME` (ej: psid)
- `HUB_SESSION_COOKIE_NAME` (ej: sid)
- `AUTH_CODE_TTL_SECONDS`
- `HUB_SESSION_TTL_SECONDS`
- `ADMIN_SYNC_TOKEN` (para llamar endpoints internos del tenant)
- `WORKOS_API_KEY`
- `WORKOS_CLIENT_ID` (si tu wrapper lo necesita; si no, igual dejarlo en .env.example para futuro)

Asegura `.env.example` con ejemplos.

---

## 2) Contratos externos (Tenant API)

De `auth_tenant` se obtienen endpoints:

- `password_check_endpoint` (URL completa)
- `user_migrated_endpoint` (URL completa, idempotente)

Tenant password-check debe responder JSON:

```json
{
  "ok": true,
  "user": { "id": "<tenant_user_id>", "email": "x@y.com" }
}
```

---

## 3) Implementación requerida: src/handlers/auth/login.rs

### 3.1 Input

- Método HTTP: SOLO POST, sino 405.
- Content-Type: aceptar JSON.
- Body: `{email,password}`
- Validar:
  - email no vacío y formato básico
  - password no vacío
  - Rechazar campos extra (si estás usando deserialización estricta)

### 3.2 Cargar pre-session SIN filtrar por query param

- Leer cookie: nombre = `PRESESSION_COOKIE_NAME`.
- Si no existe => 401 `PRESESSION_REQUIRED`.
- Buscar en `auth_pre_sessions`:
  - `_id == psid`
  - `used_at == null`
  - `expires_at > now`
- Si no existe => 401 `PRESESSION_INVALID`.

> Nota: NO consumas todavía. Primero autentica. Consume al final para no quemar el intento en caso de password malo.
> (Single-use se garantiza cuando al final llamas `consume_pre_session()`).

### 3.3 Resolver tenant config (para JIT)

- Con `pre_session.tenant_id` cargar doc en `auth_tenant`:
  - debe traer `password_check_endpoint` y `user_migrated_endpoint`.
- Si falta => 500 `TENANT_CONFIG_MISSING`.

### 3.4 Buscar user y membership

- `email_norm = normalize_email(email)`
- Buscar `auth_users` por email_norm:
  - Si existe => user_id y `provider_user_id` (puede ser null)
  - Si no existe => user_id todavía no existe
- Si existe user:
  - buscar membership para `{user_id, tenant_id}`

### 3.5 Rama A: membership existe

1. Debe existir `auth_user.provider_user_id`, si no => 409 `PROVIDER_USER_ID_MISSING`.
2. Autenticar con WorkOS usando email+password.
   - Si OK: continuar.
   - Si FAIL:
     - Llama tenant password-check (opcional) para diferenciar:
       - Si tenant devuelve ok => 409 `WORKOS_PASSWORD_MISMATCH` (mensaje: “haz reset password en Hub Identity”).
       - Si tenant devuelve invalid => 401 `INVALID_CREDENTIALS`.

### 3.6 Rama B: NO hay membership (JIT)

1. Llamar tenant `password_check_endpoint` con:
   - Header `Authorization: Bearer <ADMIN_SYNC_TOKEN>`
   - Body `{email,password}`
2. Manejar errores:
   - 401/403 => 401 `INVALID_CREDENTIALS`
   - timeout/conn refused => 502 `TENANT_UNREACHABLE`
   - 5xx => 502 `TENANT_ERROR`
   - ok=false => 401
3. Si ok:
   - `tenant_user_id = resp.user.id`
   - Upsert AuthUser:
     - si no existe, crearlo con `email = email_norm`
     - si existe, mantenerlo (solo actualizar updated_at si tienes ese campo)
   - Garantizar WorkOS user:
     - Si `provider_user_id` es null:
       - Buscar user en WorkOS por email; si no existe, crearlo.
       - Guardar `provider_user_id` en `auth_users`.
     - Si `provider_user_id` existe:
       - Intentar autenticar con WorkOS con email+password:
         - Si OK: sigue normal
         - Si FAIL: AUN ASÍ crea/upsertea membership y responde 409 `WORKOS_PASSWORD_MISMATCH`.
   - Upsert membership para `{user_id, tenant_id}`:
     - `tenant_user_id = <tenant_user_id>`
     - status = active
     - created_at/updated_at
     - Usar `update_one(..., upsert=true)` con `$setOnInsert` para evitar “if exists”.
   - Llamar `user_migrated_endpoint` (idempotente) con:
     - `{ email, provider_user_id, provider_name: "workos" }`
     - Header Authorization Bearer ADMIN_SYNC_TOKEN
     - Si falla, NO rompas login si ya autenticamos con WorkOS; pero loguea el error.

### 3.7 Final feliz (solo cuando WorkOS auth fue OK)

1. Consumir pre-session de forma atómica:
   - `consume_pre_session(psid)` => si None => 401 `PRESESSION_INVALID` (alguien la usó ya).
2. Crear hub session:
   - `create_auth_session(user_id, Some(tenant_id), Some(membership_id), HUB_SESSION_TTL_SECONDS, ip, ua)`
3. Set-Cookie de hub session:
   - name = `HUB_SESSION_COOKIE_NAME`
   - HttpOnly; SameSite=Lax; Path=/; Max-Age=ttl
   - Secure = (ENV != local)
4. Crear auth_code:
   - `create_auth_code(&pre_session, user_id, membership_id, AUTH_CODE_TTL_SECONDS)`
5. Respuesta:
   - 200 JSON `{ ok:true, redirect_to: "..."}`
6. Siempre `Cache-Control: no-store`.

### 3.8 Respuestas de error (formato)

Responder JSON:

```json
{ "ok": false, "error": { "code": "SOME_CODE", "message": "..." } }
```

---

## 4) WorkOS wrapper mínimo (no “mega refactor”, solo lo necesario)

Crear módulo simple (si no existe):

- `src/third_party_services/workos/user_management.rs`
  Funciones mínimas:
- `authenticate_with_password(email, password) -> Result<WorkOSUser, WorkOSError>`
- `get_user_by_email(email) -> Option<WorkOSUser>`
- `create_user(email, external_id?) -> WorkOSUser`

No metas features extra.

---

## 5) Wiring

- Exportar handler en `src/handlers/auth/mod.rs`
- Crear binary entrypoint en `src/bin/auth/login.rs` (igual patrón que pre_session)
- Actualizar router/main si aplica.

---

## 6) Update resume.md (obligatorio)

Reemplazar el `resume.md` por uno nuevo que incluya:

- Qué hace `login` (inputs/outputs)
- Branching JIT por memberships (sin migrations)
- Lista de env vars obligatorias (incluye cookies names)
- Ejemplos curl local (pre-session + login)

Entrega: código compilable + `resume.md` actualizado.
