# API de Reservas — Peluquería Carolina

Endpoints para la creación, consulta, confirmación y cancelación de citas de peluquería.

Base URL: `/api/v1/reservas`

---

## Endpoints

### 1. Crear una Reserva

- **Método**: `POST`
- **Ruta**: `/api/v1/reservas`
- **Headers**: `Content-Type: application/json`

#### Creador de reserva (Body)

```json
{
  "cliente_nombre": "Carolina Gómez",
  "cliente_email": "carolina@example.com",
  "cliente_telefono": "+56912345678",
  "estilista_id": "e1-carolina-valenzuela",
  "servicio_id": "s4-balayage",
  "fecha": "2026-09-01",
  "hora_inicio": "11:00",
  "notas": "Preferencia por tono natural"
}
```

#### Respuestas

##### `201 Created`
```json
{
  "status": "success",
  "data": {
    "id": "322ad91a-3f42-4680-85ab-3bca4c438f5c",
    "cliente_nombre": "Carolina Gómez",
    "cliente_email": "carolina@example.com",
    "cliente_telefono": "+56912345678",
    "estilista_id": "e1-carolina-valenzuela",
    "servicio_id": "s4-balayage",
    "fecha": "2026-09-01",
    "hora_inicio": "11:00",
    "hora_fin": "14:00",
    "estado": "pendiente",
    "precio_final": 85000.00,
    "notas": "Preferencia por tono natural",
    "created_at": "2026-08-25T21:57:53.123Z"
  }
}
```

##### `409 Conflict` (Horario ocupado o fuera de jornada)
```json
{
  "status": "error",
  "message": "El horario 11:15–12:00 no está disponible."
}
```

##### `422 Unprocessable Entity` (Error de validación)
```json
{
  "status": "error",
  "message": "Los datos de la reserva son inválidos.",
  "errores": [
    "cliente_email debe ser una dirección de correo válida."
  ]
}
```

---

### 2. Listar Reservas

- **Método**: `GET`
- **Ruta**: `/api/v1/reservas`
- **Query Params**:
  - `estilista_id` (opcional): Filtrar por estilista.
  - `fecha` (opcional): Filtrar por fecha `YYYY-MM-DD`.
  - `estado` (opcional): `pendiente`, `confirmada`, `cancelada`, `completada`.

---

### 3. Obtener Detalle de una Reserva

- **Método**: `GET`
- **Ruta**: `/api/v1/reservas/:id`

---

### 4. Confirmar Reserva (Uso Admin/Staff)

- **Método**: `PATCH`
- **Ruta**: `/api/v1/reservas/:id/confirmar`

#### Respuesta `200 OK`
```json
{
  "status": "success",
  "data": {
    "id": "322ad91a-3f42-4680-85ab-3bca4c438f5c",
    "estado": "confirmada"
  }
}
```

---

### 5. Cancelar Reserva

- **Método**: `PATCH`
- **Ruta**: `/api/v1/reservas/:id/cancelar`

> **Regla de Negocio**: La cancelación debe realizarse con al menos **12 horas de anticipación** respecto al turno reservado.

#### Respuesta `200 OK`
```json
{
  "status": "success",
  "data": {
    "id": "322ad91a-3f42-4680-85ab-3bca4c438f5c",
    "estado": "cancelada"
  }
}
```

#### Respuesta `409 Conflict` (Si quedan menos de 12h)
```json
{
  "status": "error",
  "message": "Las cancelaciones deben realizarse al menos 12 horas antes del turno."
}
```
