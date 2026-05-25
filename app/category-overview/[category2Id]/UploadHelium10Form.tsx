"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UploadHelium10Form({ category2Id }: { category2Id: string }) {
  const router = useRouter();
  const [month, setMonth] = useState("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const formEl = e.currentTarget;
    const formData = new FormData(formEl);

    const selectedFile = formData.get("file");
    const selectedToken = String(formData.get("token") ?? "");
    const selectedMonth = String(formData.get("month") ?? "");

    if (!(selectedFile instanceof File) || selectedFile.size === 0) {
      setStatus("Bitte Datei auswählen.");
      return;
    }

    if (!selectedToken) {
      setStatus("Bitte ADMIN_TOKEN eingeben.");
      return;
    }

    if (!selectedMonth || !/^\d{4}-\d{2}$/.test(selectedMonth)) {
      setStatus('Bitte Monat im Format YYYY-MM wählen.');
      return;
    }

    setIsUploading(true);
    setStatus("Upload läuft...");

    try {
      const res = await fetch("/api/import/helium10", {
        method: "POST",
        body: formData,
      });

      const text = await res.text();
      const json = text ? JSON.parse(text) : { ok: false, error: "Leere Antwort" };

      if (!json.ok) {
        setStatus(`Fehler: ${json.error}`);
        setIsUploading(false);
        return;
      }

      setStatus("Upload ok. Öffne Preview...");
      router.push(`/imports/${json.batchId}`);
    } catch (err: any) {
      setStatus(`Fehler: ${err?.message ?? "Upload fehlgeschlagen"}`);
      setIsUploading(false);
    }
  }

  return (
    <div
      style={{
        marginTop: 16,
        border: "1px solid #2a2a2a",
        borderRadius: 12,
        padding: 12,
        background: "#171717",
      }}
    >
      <div style={{ fontWeight: 800 }}>Helium10 CSV Upload</div>

      <form
        onSubmit={onSubmit}
        encType="multipart/form-data"
        style={{ marginTop: 10, display: "grid", gap: 8, maxWidth: 520 }}
      >
        <input type="hidden" name="category2Id" value={category2Id} />

        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ color: "#bdbdbd", fontSize: 13 }}>Month</span>
          <input
            type="month"
            name="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            disabled={isUploading}
            style={{
              padding: 8,
              borderRadius: 8,
              border: "1px solid #333",
              background: "#0f0f0f",
              color: "white",
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ color: "#bdbdbd", fontSize: 13 }}>ADMIN_TOKEN</span>
          <input
            type="password"
            name="token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={isUploading}
            style={{
              padding: 8,
              borderRadius: 8,
              border: "1px solid #333",
              background: "#0f0f0f",
              color: "white",
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ color: "#bdbdbd", fontSize: 13 }}>CSV-Datei</span>
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            disabled={isUploading}
            style={{ color: "#eaeaea" }}
          />
        </label>

        <button
          type="submit"
          disabled={isUploading}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #333",
            background: "#ffffff",
            color: "#000",
            fontWeight: 800,
            cursor: isUploading ? "wait" : "pointer",
            opacity: isUploading ? 0.7 : 1,
          }}
        >
          {isUploading ? "Upload läuft..." : "Upload starten"}
        </button>

        {status ? <div style={{ color: "#bdbdbd" }}>{status}</div> : null}
      </form>
    </div>
  );
}