# Cooperadora Escolar

Sistema de gestión de pagos para una cooperadora escolar. Permite administrar familias, alumnos, cuotas, pagos con imputación, recibos en PDF, egresos, cierre de caja, reportes y usuarios con distintos niveles de acceso.

Proyecto académico 2026. Stack: **Node.js + Express + Prisma + MariaDB** en el backend y **React + Vite + Material UI** en el frontend, todo en **TypeScript**.

---

## 1. Alcance funcional

| Módulo | Qué resuelve |
| --- | --- |
| Familias (socios) | Alta, edición, baja lógica y vinculación con uno o más alumnos. El sujeto de pago es la familia. |
| Alumnos | Legajo con curso, división, turno, estado y familia/s asociada/s. |
| Conceptos | Cuota social, matrícula, actividades, viajes y otros, con importe sugerido. |
| Cuotas | Generación individual o masiva por período, vencimiento, descuentos, recargos y anulación. |
| Pagos | Registro de uno o varios pagos imputados a cuotas, con medio de pago, recibo numerado y PDF. |
| Egresos | Gastos de la cooperadora con categoría, medio de pago, edición y anulación auditada. |
| Caja | Apertura con fondo inicial, cierre con efectivo contado, diferencia y detalle de movimientos. |
| Reportes | Resumen del período, ingresos por medio, recaudación mensual, morosos y libro de caja con CSV. |
| Usuarios | Roles `ADMIN`, `TESORERO` y `CONSULTA`, activación/desactivación y cambio de contraseña. |
| Configuración | Datos institucionales, prefijo de recibo y porcentaje de recargo por mora. |

---

## 2. Arquitectura

```
cooperadora/
├── api/                     Backend Express + Prisma
│   ├── prisma/
│   │   ├── schema.prisma    Modelo de datos
│   │   ├── migrations/      Migraciones SQL versionadas
│   │   └── seed.ts          Datos de demostración
│   └── src/
│       ├── modules/         Rutas por dominio (auth, guardians, fees, payments…)
│       ├── middlewares/     Autenticación, autorización, validación y errores
│       ├── config/          Entorno y cliente Prisma
│       └── utils/           Dinero, períodos, settings y helpers HTTP
├── web/                     Frontend React + Vite + MUI
│   └── src/
│       ├── pages/           Una página por módulo
│       ├── components/      Layout, tablas, chips, diálogos
│       ├── context/         Autenticación y notificaciones
│       ├── api/             Cliente Axios y tipos compartidos
│       └── utils/           Formatos de dinero, fechas y etiquetas
└── package.json             Workspaces npm (api + web)
```

### Decisiones técnicas

- **Monorepo con npm workspaces**: un solo `npm install` en la raíz.
- **Prisma con provider `mysql`**: compatible con MariaDB 11.
- **Dinero como `DECIMAL(12,2)`**: nunca `float`. Prisma lo devuelve como `Decimal` y la API lo serializa como número JSON.
- **Fechas operativas**: pagos, egresos y vencimientos se guardan como fecha calendario a medianoche UTC. El frontend las muestra en UTC para evitar el corrimiento de un día en Argentina (UTC-3).
- **Trazabilidad**: pagos y egresos no se eliminan; se anulan con motivo, usuario y fecha. Las cuotas también se anulan.
- **Recibos**: numeración anual correlativa mediante la tabla `Sequence` (`receipt-YYYY`).
- **Seguridad**: JWT, contraseñas con bcrypt, Helmet, CORS, rate limit en login y autorización por rol.

---

## 3. Requisitos

- Node.js 20 o superior
- npm 10 o superior
- MariaDB 11 (o MySQL 8 compatible) corriendo localmente
- Git

Verificar versiones:

```bash
node -v
npm -v
mariadb --version
```

---

## 4. Puesta en marcha

### 4.1. Crear la base de datos y el usuario

Conectarse como root de MariaDB:

```bash
sudo mariadb
```

Ejecutar (cambiar `TU_CLAVE` por una contraseña local):

```sql
CREATE DATABASE cooperadora
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE DATABASE cooperadora_shadow
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER 'cooperadora_user'@'localhost' IDENTIFIED BY 'TU_CLAVE';
CREATE USER 'cooperadora_user'@'127.0.0.1' IDENTIFIED BY 'TU_CLAVE';

GRANT ALL PRIVILEGES ON cooperadora.* TO 'cooperadora_user'@'localhost';
GRANT ALL PRIVILEGES ON cooperadora.* TO 'cooperadora_user'@'127.0.0.1';
GRANT ALL PRIVILEGES ON cooperadora_shadow.* TO 'cooperadora_user'@'localhost';
GRANT ALL PRIVILEGES ON cooperadora_shadow.* TO 'cooperadora_user'@'127.0.0.1';

FLUSH PRIVILEGES;
EXIT;
```

`cooperadora_shadow` es la base auxiliar que usa Prisma para generar migraciones.

### 4.2. Configurar variables de entorno

```bash
cp api/.env.example api/.env
```

Editar `api/.env`:

```env
NODE_ENV="development"
PORT=4000
DATABASE_URL="mysql://cooperadora_user:TU_CLAVE@localhost:3306/cooperadora"
SHADOW_DATABASE_URL="mysql://cooperadora_user:TU_CLAVE@localhost:3306/cooperadora_shadow"
JWT_SECRET="una-cadena-larga-y-aleatoria-de-al-menos-16-caracteres"
JWT_EXPIRES_IN="8h"
CORS_ORIGIN="http://localhost:5173"
```

> `api/.env` está ignorado por Git. No subir credenciales reales.

### 4.3. Instalar dependencias

```bash
npm install
```

### 4.4. Aplicar migraciones y datos de demostración

```bash
npm run db:migrate
npm run db:seed
```

El seed **reinicia** los datos y crea el escenario de demostración: 3 usuarios, 5 familias, 8 alumnos, 4 conceptos, 32 cuotas, 5 pagos, 3 egresos y una caja cerrada.

### 4.5. Ejecutar en desarrollo

```bash
npm run dev
```

- Frontend: <http://localhost:5173>
- API: <http://localhost:4000/api>
- Health check: <http://localhost:4000/api/health>

También se puede levantar cada parte por separado:

```bash
npm run dev:api
npm run dev:web
```

---

## 5. Credenciales de demostración

| Rol | Email | Contraseña | Permisos |
| --- | --- | --- | --- |
| ADMIN | `admin@cooperadora.edu` | `Admin1234` | Acceso total, usuarios y configuración |
| TESORERO | `tesorero@cooperadora.edu` | `Tesorero1234` | Operación diaria: pagos, cuotas, egresos y caja |
| CONSULTA | `consulta@cooperadora.edu` | `Consulta1234` | Solo lectura de datos operativos |

> Estas credenciales son exclusivamente para la demostración académica.

---

## 6. Scripts disponibles

Desde la raíz:

```bash
npm run dev          # API + frontend en paralelo
npm run dev:api      # Solo API con recarga en caliente
npm run dev:web      # Solo frontend
npm run build        # Compila API y frontend
npm run db:migrate   # Crea/aplica migraciones de Prisma
npm run db:seed      # Reinicia y carga datos demo
npm run db:studio    # Abre Prisma Studio
npm test             # Tests unitarios de la API (Vitest)
```

Para ejecutar el build de producción:

```bash
npm run build
npm run start -w api   # API compilada en dist/
npm run preview -w web # Vista previa del frontend compilado
```

---

## 7. Reglas de negocio principales

1. **La familia es el sujeto de pago.** Un pago pertenece a una familia y se imputa a cuotas de cualquiera de sus alumnos.
2. **Una cuota pertenece a un alumno, concepto y período.** No puede existir duplicada (`studentId + conceptId + period`).
3. **Importe de cuota** = `amount - discount + surcharge`. El saldo = total - `paidAmount`.
4. **Estados de cuota**: `PENDIENTE`, `PARCIAL`, `PAGA`, `ANULADA`. Se recalculan al registrar o anular pagos.
5. **Un pago puede cubrir varias cuotas** y una cuota puede pagarse en partes, pero nunca por encima de su saldo.
6. **Los pagos no se eliminan.** Se anulan con motivo; sus imputaciones se revierten y las cuotas vuelven a su estado anterior.
7. **Los egresos tampoco se eliminan.** Se anulan con motivo y dejan de impactar en caja y reportes.
8. **Recargo por mora** solo sobre cuotas vencidas, pendientes o parciales, y solo si no tienen recargo previo.
9. **Cierre de caja**: compara el efectivo contado con `fondo inicial + ingresos en efectivo - egresos en efectivo`. La diferencia queda registrada.
10. **Recibos**: numeración correlativa por año, generada en una transacción para evitar duplicados.
11. **Bajas lógicas**: usuarios y familias se desactivan; alumnos pasan a `INACTIVO` o `EGRESADO`. Los registros históricos se conservan.
12. **Fechas**: se interpretan como fechas calendario. Los filtros de reportes usan límites UTC para no perder movimientos del primer día del mes.

---

## 8. API REST

Base: `http://localhost:4000/api`. Todos los endpoints salvo login, health y settings públicos requieren `Authorization: Bearer <token>`.

### Autenticación y usuarios

| Método | Endpoint | Descripción |
| --- | --- | --- |
| POST | `/auth/login` | Inicia sesión y devuelve JWT |
| GET | `/auth/me` | Usuario autenticado |
| PATCH | `/auth/me/password` | Cambia la contraseña propia |
| GET/POST | `/users` | Lista / crea usuarios (ADMIN) |
| PUT/DELETE | `/users/:id` | Edita / desactiva usuarios (ADMIN) |

### Datos maestros

| Método | Endpoint | Descripción |
| --- | --- | --- |
| GET/POST | `/guardians` | Familias |
| GET/PUT/DELETE | `/guardians/:id` | Detalle, edición y baja lógica |
| POST/DELETE | `/guardians/:id/students` | Vincula / desvincula alumnos |
| GET/POST | `/students` | Alumnos |
| GET/PUT/DELETE | `/students/:id` | Detalle, edición y baja |
| GET/POST | `/concepts` | Conceptos de cuota |
| PUT/DELETE | `/concepts/:id` | Edición y baja lógica |

### Operación

| Método | Endpoint | Descripción |
| --- | --- | --- |
| GET/POST | `/fees` | Cuotas con filtros y paginación |
| POST | `/fees/generate` | Generación masiva por período |
| PUT | `/fees/:id` | Edita importe, descuento o vencimiento |
| POST | `/fees/:id/cancel` | Anula una cuota |
| POST | `/fees/apply-surcharges` | Aplica recargos a vencidas |
| GET/POST | `/payments` | Lista / registra pagos |
| POST | `/payments/:id/cancel` | Anula un pago y revierte imputaciones |
| GET | `/payments/:id/receipt` | Descarga el recibo en PDF |
| GET/POST | `/expenses` | Lista / registra egresos |
| PUT | `/expenses/:id` | Edita un egreso activo |
| POST | `/expenses/:id/cancel` | Anula un egreso |

### Caja y reportes

| Método | Endpoint | Descripción |
| --- | --- | --- |
| GET | `/cash/current` | Caja abierta y resumen |
| POST | `/cash/open` | Abre caja con fondo inicial |
| POST | `/cash/close` | Cierra caja con efectivo contado |
| GET | `/cash/sessions` | Historial paginado |
| GET | `/cash/sessions/:id` | Detalle de una caja |
| GET | `/reports/summary` | Ingresos, egresos, balance y deuda |
| GET | `/reports/income-by-method` | Ingresos por medio de pago |
| GET | `/reports/monthly-income` | Recaudación por mes |
| GET | `/reports/delinquents` | Alumnos con cuotas vencidas |
| GET | `/reports/account/:guardianId` | Estado de cuenta de una familia |
| GET | `/reports/cash-book` | Libro de caja con saldo acumulado |
| GET | `/reports/dashboard` | Datos agregados del dashboard |
| GET | `/settings/public` | Datos institucionales públicos |
| GET/PUT | `/settings` | Configuración completa (ADMIN para editar) |

Los errores se devuelven como JSON con `{ "message": "..." }` y el código HTTP correspondiente (`400`, `401`, `403`, `404`, `409` o `500`).

---

## 9. Guion de demostración

Sugerencia para la defensa del proyecto (10–15 minutos):

1. **Login como ADMIN** y mostrar el dashboard: recaudación del mes, deuda vencida, últimos pagos y estado de caja.
2. **Familias → Familia López**: mostrar alumnos vinculados y estado de cuenta consolidado.
3. **Cuotas**: filtrar por período y estado; mostrar una cuota parcial y una vencida.
4. **Registrar un pago** desde “Registrar pago”:
   - Elegir familia y alumno.
   - Seleccionar una o más cuotas pendientes.
   - Ver el total calculado e imputar el pago.
   - Descargar el **recibo PDF** generado.
5. **Anular el pago** con un motivo y verificar que la cuota vuelve a su estado anterior (trazabilidad).
6. **Egresos**: crear un gasto y luego anularlo, mostrando que queda auditado.
7. **Caja**: abrir caja, registrar un pago en efectivo, cerrar caja y comparar el efectivo contado con el esperado.
8. **Reportes**: mostrar resumen del período, gráfico mensual, ingresos por medio, morosos y libro de caja; exportar un CSV.
9. **Usuarios**: crear un usuario `CONSULTA` y demostrar que no puede acceder a la administración de usuarios.
10. **Configuración**: cambiar el nombre de la cooperadora o el porcentaje de recargo.
11. **Cerrar sesión** e ingresar como CONSULTA para mostrar la vista restringida.

---

## 10. Tests

```bash
npm test
```

Los tests unitarios cubren los cálculos de dinero (total, saldo, estado de cuota) y el manejo de períodos, vencimientos y rangos de fechas en UTC.

---

## 11. Notas para producción

- Cambiar `JWT_SECRET` y las contraseñas de la base.
- Servir el frontend compilado detrás de un proxy inverso (Nginx/Caddy) con HTTPS.
- Configurar backups periódicos de MariaDB.
- Ajustar `CORS_ORIGIN` al dominio real.
- Revisar `npm audit` y actualizar dependencias.
- El seed está pensado para demostración: **no ejecutarlo en producción** porque borra los datos existentes.

---

## 12. Estado del proyecto

- API y frontend completos y compilando en TypeScript estricto.
- Migración inicial aplicada y seed funcional.
- Flujo de pagos, recibos PDF, anulaciones, caja y reportes probado de punta a punta.
- Tests unitarios de reglas de negocio principales.
- Datos de demostración incluidos.

Proyecto académico — Sistema de gestión de pagos para cooperadoras escolares.
