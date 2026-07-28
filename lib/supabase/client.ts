import { createBrowserClient } from "@supabase/ssr";

// Este cliente se usa en componentes de cliente ("use client").
// Lee la URL y la llave pública (anon) de las variables de entorno —
// nunca pongas aquí la service_role key.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
