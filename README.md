# Prestamos Keydi

Sistema web React + Vite para gestion integral de prestamos personales con Supabase Auth y Supabase PostgreSQL.

## Stack

- React + Vite
- React Router
- React Hook Form
- Tailwind CSS
- Lucide React
- Supabase Auth, PostgreSQL y Storage

## Variables de entorno

Crear `.env.local` localmente, sin subirlo al repositorio:

```bash
VITE_SUPABASE_URL=tu_url
VITE_SUPABASE_ANON_KEY=tu_anon_key
```

No se usa Service Role Key en el frontend.

## Supabase

Ejecuta `supabase/migrations.sql` en el SQL Editor de Supabase. La migracion agrega:

- `user_id`, `fecha_creacion`, `fecha_actualizacion`
- campos financieros/documentales requeridos
- tabla `configuracion`
- Row Level Security por usuario
- buckets publicos `firmas` y `documentos` con politicas por carpeta de usuario

Las tablas esperadas son: `clientes`, `avales`, `prestamos`, `cuotas` y `pagos`.

## Funcionalidad

- Login/logout con persistencia de sesion y rutas protegidas.
- CRUD de clientes y avales con validacion de identidad, telefono, correo y nombres en mayusculas.
- Prestamos con interes total pactado para todo el plazo, sin interes compuesto.
- Generacion automatica de cuotas mensuales o quincenales con ajuste de centavos en la ultima cuota.
- Pagos, recalculo de saldo y cancelacion automatica del prestamo al completar cuotas.
- Dashboard, alertas de vencimiento y recordatorios por enlaces `wa.me`.
- Configuracion de acreedora, logo y firma.
- Vista previa de contrato y pagare con firmas canvas e impresion mediante `window.print()`.
- Tema claro/oscuro y diseno responsive para movil, tablet y escritorio.

## Comandos

```bash
npm install
npm run dev
npm run build
npm run lint
```

Para Vercel, configura las mismas variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en el panel del proyecto.
