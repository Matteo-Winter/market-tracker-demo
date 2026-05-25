"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const HOME_PATH = "/toolbox";

function getSafeNextPath(value: string | null) {
  if (!value || value === "/") return HOME_PATH;
  if (!value.startsWith("/") || value.startsWith("//")) return HOME_PATH;
  if (value.startsWith("/login")) return HOME_PATH;
  return value;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const json = await res.json();

      if (!json.ok) {
        setError(json.error ?? "Login fehlgeschlagen.");
        return;
      }

      router.push(getSafeNextPath(searchParams.get("next")));
      router.refresh();
    } catch {
      setError("Login fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, rgba(59,130,246,0.18), transparent 34%), #070707",
        color: "#f5f5f5",
        display: "grid",
        placeItems: "center",
        padding: 24,
        fontFamily: "system-ui",
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: "min(420px, 100%)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 24,
          background:
            "linear-gradient(180deg, rgba(18,18,18,0.98), rgba(8,8,8,0.98))",
          padding: 24,
          boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
          display: "grid",
          gap: 14,
        }}
      >
        <div>
          <div
            style={{
              display: "inline-flex",
              borderRadius: 999,
              border: "1px solid rgba(125,211,252,0.22)",
              background: "rgba(14,165,233,0.12)",
              color: "#bae6fd",
              padding: "6px 10px",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Geschützter Bereich
          </div>

          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>
            ToolBox Login
          </h1>

          <p style={{ color: "#a1a1aa", marginTop: 8, marginBottom: 0 }}>
            Bitte Passwort eingeben, um fortzufahren.
          </p>
        </div>

        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Passwort"
          autoFocus
          style={{
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "#070707",
            color: "#fff",
            padding: "12px 14px",
            fontSize: 16,
            outline: "none",
          }}
        />

        {error ? (
          <div
            style={{
              borderRadius: 12,
              border: "1px solid rgba(239,68,68,0.25)",
              background: "rgba(239,68,68,0.08)",
              color: "#fecaca",
              fontWeight: 700,
              padding: "10px 12px",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          style={{
            borderRadius: 14,
            border: "none",
            background: "#fff",
            color: "#000",
            fontWeight: 900,
            padding: "12px 14px",
            cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.75 : 1,
          }}
        >
          {loading ? "Prüfe..." : "Einloggen"}
        </button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}