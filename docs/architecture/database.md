# Arquitectura de Base de Datos — Peluquería Carolina

## Tecnología
**Supabase (PostgreSQL)** — Base de datos relacional gestionada con RLS integrado y cliente REST/JS.

---

## Diagrama Entidad-Relación

```mermaid
erDiagram
    SERVICIOS {
        uuid id PK
        varchar nombre
        text descripcion
        int duracion_min
        numeric precio
        varchar categoria
        bool activo
        bool en_seleccion
        int orden
        text imagen_url
        varchar etiqueta
        varchar icono
        bool destacado
    }

    ESTILISTAS {
        uuid id PK
        varchar nombre
        varchar apellido
        varchar especialidad
        text bio
        text foto_url
        varchar nivel
        bool activo
    }

    ESTILISTA_SERVICIOS {
        uuid estilista_id FK
        uuid servicio_id FK
    }

    DISPONIBILIDAD {
        uuid id PK
        uuid estilista_id FK
        smallint dia_semana
        time hora_inicio
        time hora_fin
    }

    CLIENTES {
        uuid id PK
        uuid auth_user_id
        varchar nombre
        varchar apellido
        varchar email
        varchar telefono
        text notas_ia
    }

    RESERVAS {
        uuid id PK
        varchar codigo_reserva UK
        uuid cliente_id FK
        uuid estilista_id FK
        uuid servicio_id FK
        date fecha
        time hora_inicio
        time hora_fin
        varchar estado
        numeric precio_final
        text notas
    }

    ESTILISTAS ||--o{ ESTILISTA_SERVICIOS : "ofrece"
    SERVICIOS  ||--o{ ESTILISTA_SERVICIOS : "realizado por"
    ESTILISTAS ||--o{ DISPONIBILIDAD     : "tiene horario"
    CLIENTES   ||--o{ RESERVAS           : "agenda"
    ESTILISTAS ||--o{ RESERVAS           : "atiende"
    SERVICIOS  ||--o{ RESERVAS           : "incluye"
```

---

## Tablas

| Tabla               | Descripción |
|---------------------|-------------|
| `servicios`         | Catálogo de servicios con duración y precio |
| `estilistas`        | Perfiles y niveles de los profesionales |
| `estilista_servicios` | Relación N:M entre estilistas y servicios |
| `disponibilidad`    | Bloques horarios semanales por estilista |
| `clientes`          | Clientes registrados (se vincula con `auth.users` en Fase 8) |
| `reservas`          | Historial y estado de todas las citas |

---

## Estados de una Reserva

```
pendiente → confirmada → completada
                      ↘ cancelada
                      ↘ no_asistio
```

| Estado       | Descripción |
|--------------|-------------|
| `pendiente`  | Creada, en espera de confirmación del salón |
| `confirmada` | Aprobada, aparece en el calendario del estilista |
| `cancelada`  | Cancelada por el cliente o el salón |
| `completada` | El servicio fue realizado |
| `no_asistio` | El cliente no se presentó |

---

## Niveles de Estilista

| Nivel     | Descripción |
|-----------|-------------|
| `artisan` | Profesional con experiencia media |
| `senior`  | Especialista avanzado |
| `master`  | Maestro del sector, mayor tarifa |

---

## Seguridad (Row Level Security)

| Tabla               | Lectura       | Escritura |
|---------------------|---------------|-----------|
| `servicios`         | Pública (activos) | Admin solo |
| `estilistas`        | Pública (activos) | Admin solo |
| `disponibilidad`    | Pública       | Admin solo |
| `clientes`          | Solo el propio usuario | Solo el propio usuario |
| `reservas`          | Solo las del usuario | Solo el propio usuario |

> **Nota:** Las políticas RLS de `clientes` y `reservas` se activan completamente en **Fase 8** cuando se integra Supabase Auth.
