# API de Servicios y Estilistas — Peluquería Carolina

Documentación de endpoints para el catálogo de servicios ("Nuestra Selección") y la nómina de estilistas.

Base URL: `/api/v1`

---

## 1. Servicios ("Nuestra Selección" y Administración)

### 1.1 Listar servicios de "Nuestra Selección" (Público Optimizado)
- **Método**: `GET`
- **Ruta**: `/api/v1/servicios/seleccion`
- **Filtros por Query Parameters**:
  - `categoria` (opcional): `coloracion`, `corte`, `tratamiento`, `barberia`, `styling`, `manicura`.
- **Comportamiento**: Devuelve únicamente los servicios con `activo = true` y `en_seleccion = true`, ordenados por `orden ASC`, con cabeceras `Cache-Control: no-store`.

### 1.2 Listar catálogo de servicios
- **Método**: `GET`
- **Ruta**: `/api/v1/servicios`
- **Filtros por Query Parameters**:
  - `categoria` (opcional): `coloracion`, `corte`, `tratamiento`, `barberia`, `styling`, `manicura`.
  - `incluir_inactivos` (opcional): `true` para administración (devuelve activos e inactivos).
  - `seleccion` (opcional): `true` o `false`.

### 1.3 Obtener detalle de servicio
- **Método**: `GET`
- **Ruta**: `/api/v1/servicios/:id`

### 1.4 Crear nuevo servicio (Admin)
- **Método**: `POST`
- **Ruta**: `/api/v1/servicios`
- **Autenticación**: `Bearer <admin_token>` (`requireAuth`, `requireAdmin`)
- **Payload JSON**:
```json
{
  "nombre": "Ritual Detox Capilar Botánico",
  "etiqueta": "Purificación & Oxigenación",
  "descripcion": "Exfoliación suave del cuero cabelludo con arcilla blanca y vapor de ozono.",
  "duracion_min": 60,
  "precio": 36000,
  "categoria": "tratamiento",
  "orden": 11,
  "icono": "spa",
  "imagen_url": "/images/servicios/servicio_6.webp",
  "en_seleccion": true,
  "activo": true,
  "destacado": false
}
```

### 1.5 Actualizar servicio (Admin)
- **Método**: `PUT` / `PATCH`
- **Ruta**: `/api/v1/servicios/:id`
- **Autenticación**: `Bearer <admin_token>` (`requireAuth`, `requireAdmin`)

### 1.6 Conmutar visibilidad rápida (Admin)
- **Método**: `PATCH`
- **Ruta**: `/api/v1/servicios/:id/visibilidad`
- **Autenticación**: `Bearer <admin_token>` (`requireAuth`, `requireAdmin`)
- **Payload JSON**:
```json
{
  "en_seleccion": false,
  "activo": true
}
```

### 1.7 Eliminar servicio (Admin)
- **Método**: `DELETE`
- **Ruta**: `/api/v1/servicios/:id`
- **Autenticación**: `Bearer <admin_token>` (`requireAuth`, `requireAdmin`)

---

## 2. Estilistas

### 2.1 Listar todos los estilistas
- **Método**: `GET`
- **Ruta**: `/api/v1/estilistas`
- **Filtros por Query Parameters**:
  - `nivel` (opcional): `artisan`, `senior`, `master`.

### 2.2 Obtener detalle de estilista
- **Método**: `GET`
- **Ruta**: `/api/v1/estilistas/:id`

### 2.3 Obtener servicios por estilista
- **Método**: `GET`
- **Ruta**: `/api/v1/estilistas/:id/servicios`
