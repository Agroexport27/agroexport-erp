"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function iniciarSesion() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      setError("Correo o contraseña incorrectos.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf9f5]">
      <div className="card w-full max-w-sm p-6">
        <p className="text-sm font-semibold text-campo-800">Agroexport</p>
        <h1 className="mt-1 text-xl font-semibold text-campo-900">
          Iniciar sesión
        </h1>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-campo-600">
            Correo
          </label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && iniciarSesion()}
          />
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-campo-600">
            Contraseña
          </label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && iniciarSesion()}
          />
        </div>
        <button
          className="btn-primary mt-5 w-full"
          onClick={iniciarSesion}
          disabled={loading}
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </div>
    </div>
  );
}
