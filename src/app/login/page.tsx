"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button, Field, Input } from "@/components/ui";
import { APP_NAME, BASE_PATH } from "@/lib/app";
import { supabase } from "@/lib/supabase";

type Mode = "sign-in" | "sign-up";

export default function LoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  useEffect(() => {
    if (auth.status === "signed-in") router.replace("/");
  }, [auth.status, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage(null);

    if (mode === "sign-in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage({ kind: "error", text: translateError(error.message) });
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + BASE_PATH },
      });
      if (error) setMessage({ kind: "error", text: translateError(error.message) });
      else if (!data.session)
        setMessage({ kind: "info", text: "Conta criada. Confirme pelo link enviado ao seu e-mail." });
    }
    setBusy(false);
  }

  async function signInWithGoogle() {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + BASE_PATH },
    });
    if (error) setMessage({ kind: "error", text: translateError(error.message) });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-4 py-10">
      <header className="text-center">
        <h1 className="text-4xl font-black tracking-tight text-accent">{APP_NAME}</h1>
        <p className="mt-2 text-muted">Ficha, cargas e evolução no mesmo lugar.</p>
      </header>

      <div className="grid grid-cols-2 rounded-xl bg-surface p-1">
        {(["sign-in", "sign-up"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`h-10 rounded-lg text-sm font-semibold ${
              mode === m ? "bg-surface-2 text-foreground" : "text-muted"
            }`}
          >
            {m === "sign-in" ? "Entrar" : "Criar conta"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="E-mail">
          <Input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Senha">
          <Input
            type="password"
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        {message && (
          <p className={`text-sm ${message.kind === "error" ? "text-danger" : "text-accent"}`}>
            {message.text}
          </p>
        )}

        <Button type="submit" disabled={busy}>
          {busy ? "Aguarde…" : mode === "sign-in" ? "Entrar" : "Criar conta"}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" />
        ou
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button variant="secondary" onClick={signInWithGoogle}>
        Continuar com Google
      </Button>
    </main>
  );
}

function translateError(message: string): string {
  if (message.includes("Invalid login credentials")) return "E-mail ou senha incorretos.";
  if (message.includes("Email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (message.includes("User already registered")) return "Este e-mail já tem conta. Use Entrar.";
  if (message.includes("Failed to fetch")) return "Sem conexão. Tente de novo quando tiver internet.";
  return message;
}
