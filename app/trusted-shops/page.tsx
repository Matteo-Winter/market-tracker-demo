"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type OrderRow = {
  orderDate: string;
  orderReference: string;
  email: string | null;
  name: string;
  paymentStatus: string;
};

type ExportRow = {
  mail: string;
  name: string;
  orderReference: string;
  orderDate: string;
};

type DownloadFile = {
  filename: string;
  rowCount: number;
  url: string;
};

type Summary = {
  totalOrders: number;
  paidOrders: number;
  skippedNonPaid: number;
  skippedMissingEmail: number;
  duplicateEmails: number;
  supportMatches: number;
  finalRecipients: number;
  exportFileCount: number;
};

const ACCENT_BORDER = "rgba(52, 211, 153, 0.35)";
const ACCENT_BG = "rgba(52, 211, 153, 0.12)";
const BATCH_SIZE = 800;

function scoreDecodedText(value: string) {
  let replacementCount = 0;
  let controlCount = 0;

  for (const char of value) {
    const code = char.charCodeAt(0);
    if (char === "\uFFFD") replacementCount += 1;
    if (code < 32 && char !== "\n" && char !== "\r" && char !== "\t") controlCount += 1;
  }

  return replacementCount * 100 + controlCount;
}

function decodeWithFallback(buffer: ArrayBuffer, labels: string[]) {
  let bestText = "";
  let bestScore = Number.POSITIVE_INFINITY;

  for (const label of labels) {
    try {
      const decoded = new TextDecoder(label).decode(buffer);
      const score = scoreDecodedText(decoded);
      if (score < bestScore) {
        bestText = decoded;
        bestScore = score;
      }
      if (score === 0) return decoded;
    } catch {
      // ignore encoding and try the next one
    }
  }

  return bestText;
}

function parseSemicolonCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ";") {
      row.push(value);
      value = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((entry) => entry.length > 0)) rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  row.push(value);
  if (row.some((entry) => entry.length > 0)) rows.push(row);
  return rows;
}

function normalizeEmail(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const angleMatch = trimmed.match(/<([^<>]+@[^<>]+)>/);
  const candidate = (angleMatch?.[1] ?? trimmed)
    .replace(/^"+|"+$/g, "")
    .replace(/^'+|'+$/g, "")
    .replace(/^<+|>+$/g, "")
    .trim()
    .toLowerCase();

  if (!candidate.includes("@") || candidate.includes(" ")) return null;
  return candidate;
}

function xmlText(row: Element, tagName: string) {
  return row.querySelector(tagName)?.textContent?.trim() ?? "";
}

function parseOrdersXml(xml: string) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("Die XML-Datei konnte nicht gelesen werden.");
  }

  return Array.from(doc.querySelectorAll("row")).map((row): OrderRow => ({
    orderDate: xmlText(row, "day"),
    orderReference: xmlText(row, "order_name"),
    email: normalizeEmail(xmlText(row, "customer_email")),
    name: xmlText(row, "customer_name"),
    paymentStatus: xmlText(row, "order_payment_status").toLowerCase(),
  }));
}

function readSupportEmails(csvText: string) {
  const rows = parseSemicolonCsv(csvText);
  if (rows.length === 0) throw new Error("Die Support-CSV ist leer.");

  const header = rows[0].map((value) => value.trim());
  const identifierIndex = header.findIndex((value) => value === "Item.From.Identifier");
  const fromTextIndex = header.findIndex((value) => value === "Item.From.Text");

  if (identifierIndex < 0 && fromTextIndex < 0) {
    throw new Error("In der Support-CSV wurde keine E-Mail-Spalte gefunden.");
  }

  const emails = new Set<string>();
  for (const row of rows.slice(1)) {
    const normalized =
      normalizeEmail(identifierIndex >= 0 ? row[identifierIndex] : null) ??
      normalizeEmail(fromTextIndex >= 0 ? row[fromTextIndex] : null);
    if (normalized) emails.add(normalized);
  }

  return emails;
}

function csvEscape(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function buildExportCsv(rows: ExportRow[]) {
  const header = ["Mail", "Name", "Bestellreferenz", "Bestelldatum"];
  const lines = [header.map(csvEscape).join(";")];

  for (const row of rows) {
    lines.push([row.mail, row.name, row.orderReference, row.orderDate].map(csvEscape).join(";"));
  }

  return lines.join("\r\n");
}

function chunkRows<T>(rows: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

function safeSlug(value: string) {
  const cleaned = value.trim().replace(/\s+/g, "-").replace(/[^a-zA-Z0-9_-]/g, "");
  return cleaned || "offen";
}

function buildFilename(kwData: string, kwVersand: string, index: number, total: number) {
  const base = `trusted-shops_kw-daten-${safeSlug(kwData)}_kw-versand-${safeSlug(kwVersand)}`;
  if (total <= 1) return `${base}.csv`;
  return `${base}_${String(index + 1).padStart(2, "0")}.csv`;
}

function StatCard({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "accent" | "danger" }) {
  const border = tone === "accent" ? ACCENT_BORDER : tone === "danger" ? "rgba(248,113,113,0.35)" : "#22262b";
  const background = tone === "accent" ? ACCENT_BG : tone === "danger" ? "rgba(127,29,29,0.16)" : "#0f1113";

  return (
    <div style={{ borderRadius: 16, border: `1px solid ${border}`, background, padding: 16, display: "grid", gap: 8 }}>
      <div style={{ color: "#8a9098", fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ color: "#f5f7f8", fontSize: 28, fontWeight: 900 }}>{value}</div>
    </div>
  );
}

export default function TrustedShopsPage() {
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [supportFile, setSupportFile] = useState<File | null>(null);
  const [kwData, setKwData] = useState("");
  const [kwVersand, setKwVersand] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [downloads, setDownloads] = useState<DownloadFile[]>([]);

  useEffect(() => {
    return () => {
      for (const file of downloads) URL.revokeObjectURL(file.url);
    };
  }, [downloads]);

  async function handleProcess() {
    setError(null);
    if (!xmlFile || !supportFile) {
      setError("Bitte lade sowohl die XML-Datei als auch die Support-CSV hoch.");
      return;
    }

    setIsProcessing(true);

    try {
      for (const file of downloads) URL.revokeObjectURL(file.url);
      setDownloads([]);
      setSummary(null);

      const ordersXml = new TextDecoder("utf-8").decode(await xmlFile.arrayBuffer());
      const supportText = decodeWithFallback(await supportFile.arrayBuffer(), ["utf-8", "windows-1252", "iso-8859-1"]);

      const parsedOrders = parseOrdersXml(ordersXml);
      const supportEmails = readSupportEmails(supportText);

      let skippedNonPaid = 0;
      let skippedMissingEmail = 0;
      let duplicateEmails = 0;

      const unique = new Map<string, ExportRow>();
      for (const order of parsedOrders) {
        if (order.paymentStatus !== "paid") {
          skippedNonPaid += 1;
          continue;
        }
        if (!order.email) {
          skippedMissingEmail += 1;
          continue;
        }
        if (unique.has(order.email)) {
          duplicateEmails += 1;
          continue;
        }
        unique.set(order.email, {
          mail: order.email,
          name: order.name,
          orderReference: order.orderReference,
          orderDate: order.orderDate,
        });
      }

      let supportMatches = 0;
      const finalRows: ExportRow[] = [];
      for (const row of unique.values()) {
        if (supportEmails.has(row.mail)) {
          supportMatches += 1;
          continue;
        }
        finalRows.push(row);
      }

      const chunks = chunkRows(finalRows, BATCH_SIZE);
      const nextDownloads = chunks.map((chunk, index) => {
        const csvText = buildExportCsv(chunk);
        const blob = new Blob([`\uFEFF${csvText}`], { type: "text/csv;charset=utf-8;" });
        return {
          filename: buildFilename(kwData || "offen", kwVersand || "offen", index, chunks.length),
          rowCount: chunk.length,
          url: URL.createObjectURL(blob),
        } satisfies DownloadFile;
      });

      setDownloads(nextDownloads);
      setSummary({
        totalOrders: parsedOrders.length,
        paidOrders: parsedOrders.length - skippedNonPaid,
        skippedNonPaid,
        skippedMissingEmail,
        duplicateEmails,
        supportMatches,
        finalRecipients: finalRows.length,
        exportFileCount: nextDownloads.length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Die Dateien konnten nicht verarbeitet werden.");
    } finally {
      setIsProcessing(false);
    }
  }

  function handleDownloadAll() {
    downloads.forEach((file, index) => {
      window.setTimeout(() => {
        const link = document.createElement("a");
        link.href = file.url;
        link.download = file.filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }, index * 160);
    });
  }

  return (
    <main style={{ minHeight: "100vh", background: "#070809", color: "#f5f6f7", padding: 24 }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ borderRadius: 24, border: "1px solid #1d2024", background: "#0b0d0f", padding: 24, display: "grid", gap: 18, boxShadow: "0 24px 50px rgba(0,0,0,0.18)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "grid", gap: 8 }}>
              <h1 style={{ margin: 0, fontSize: 34, fontWeight: 900, letterSpacing: "-0.04em" }}>Trusted Shops Tool</h1>
              <div style={{ color: "#9aa1a9", fontSize: 15, lineHeight: 1.5, maxWidth: 760 }}>
                Lade deine Bestell-XML und die aktuelle Support-CSV hoch. Die Verarbeitung läuft nur lokal im Browser. Es werden keine Kundendaten gespeichert oder serverseitig abgelegt.
              </div>
            </div>

            <Link href="/toolbox" style={{ borderRadius: 12, border: "1px solid #272a2f", background: "#111315", color: "#f3f4f6", textDecoration: "none", fontWeight: 800, padding: "11px 14px" }}>
              Zur Toolbox
            </Link>
          </div>

          <div style={{ borderRadius: 16, border: `1px solid ${ACCENT_BORDER}`, background: ACCENT_BG, padding: 14, color: "#d1fae5", fontSize: 14, lineHeight: 1.55 }}>
            Regeln: Nur Bestellungen mit Status <strong>paid</strong> werden berücksichtigt. Doppelte E-Mails und E-Mails aus der Support-CSV werden entfernt. Die fertige Versandliste wird automatisch in Pakete mit maximal {BATCH_SIZE} Kunden aufgeteilt.
          </div>

          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            <div style={{ borderRadius: 18, border: "1px solid #1f2327", background: "#0d0f11", padding: 16, display: "grid", gap: 12 }}>
              <div style={{ color: "#8a9098", fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>XML Bestelldaten</div>
              <input type="file" accept=".xml,text/xml,application/xml" onChange={(event) => setXmlFile(event.target.files?.[0] ?? null)} style={{ borderRadius: 12, border: "1px solid #2a2d31", background: "#111315", color: "#e4e4e7", padding: 12 }} />
              <div style={{ color: "#98a1ab", fontSize: 13 }}>{xmlFile ? xmlFile.name : "Noch keine XML ausgewählt"}</div>
            </div>

            <div style={{ borderRadius: 18, border: "1px solid #1f2327", background: "#0d0f11", padding: 16, display: "grid", gap: 12 }}>
              <div style={{ color: "#8a9098", fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>Support CSV</div>
              <input type="file" accept=".csv,text/csv" onChange={(event) => setSupportFile(event.target.files?.[0] ?? null)} style={{ borderRadius: 12, border: "1px solid #2a2d31", background: "#111315", color: "#e4e4e7", padding: 12 }} />
              <div style={{ color: "#98a1ab", fontSize: 13 }}>{supportFile ? supportFile.name : "Noch keine CSV ausgewählt"}</div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <div style={{ borderRadius: 18, border: "1px solid #1f2327", background: "#0d0f11", padding: 16, display: "grid", gap: 10 }}>
              <label htmlFor="kw-daten" style={{ color: "#8a9098", fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>KW Daten</label>
              <input id="kw-daten" value={kwData} onChange={(event) => setKwData(event.target.value)} placeholder="z. B. 36" style={{ borderRadius: 12, border: "1px solid #2a2d31", background: "#111315", color: "#e4e4e7", padding: 12 }} />
            </div>

            <div style={{ borderRadius: 18, border: "1px solid #1f2327", background: "#0d0f11", padding: 16, display: "grid", gap: 10 }}>
              <label htmlFor="kw-versand" style={{ color: "#8a9098", fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>KW Versand</label>
              <input id="kw-versand" value={kwVersand} onChange={(event) => setKwVersand(event.target.value)} placeholder="z. B. 37" style={{ borderRadius: 12, border: "1px solid #2a2d31", background: "#111315", color: "#e4e4e7", padding: 12 }} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={handleProcess} disabled={isProcessing} style={{ borderRadius: 12, border: `1px solid ${ACCENT_BORDER}`, background: ACCENT_BG, color: "#ecfdf5", fontWeight: 900, padding: "12px 18px", cursor: isProcessing ? "default" : "pointer", opacity: isProcessing ? 0.7 : 1 }}>
              {isProcessing ? "Dateien werden verarbeitet ..." : "Versandliste vorbereiten"}
            </button>

            {downloads.length > 0 ? (
              <button type="button" onClick={handleDownloadAll} style={{ borderRadius: 12, border: "1px solid #272a2f", background: "#111315", color: "#f3f4f6", fontWeight: 800, padding: "12px 18px", cursor: "pointer" }}>
                {downloads.length <= 1 ? "Datei herunterladen" : `${downloads.length} Dateien herunterladen`}
              </button>
            ) : null}
          </div>

          {error ? <div style={{ borderRadius: 14, border: "1px solid rgba(248,113,113,0.35)", background: "rgba(127,29,29,0.18)", padding: 12, color: "#fecaca", fontWeight: 700 }}>{error}</div> : null}
        </section>

        {summary ? (
          <section style={{ borderRadius: 24, border: "1px solid #1d2024", background: "#0b0d0f", padding: 20, display: "grid", gap: 16, boxShadow: "0 24px 50px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>Ergebnis</h2>
              <div style={{ color: "#9aa1a9", fontSize: 14 }}>Die Zahlen unten zeigen dir, wie die Versandliste bereinigt wurde.</div>
            </div>

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <StatCard label="Gesamt aus XML" value={summary.totalOrders} />
              <StatCard label="Davon paid" value={summary.paidOrders} />
              <StatCard label="Nicht paid entfernt" value={summary.skippedNonPaid} tone="danger" />
              <StatCard label="Ohne E-Mail entfernt" value={summary.skippedMissingEmail} tone="danger" />
              <StatCard label="Doppelte E-Mails" value={summary.duplicateEmails} tone="danger" />
              <StatCard label="Im Supportkontakt" value={summary.supportMatches} tone="danger" />
              <StatCard label="Finale Empfänger" value={summary.finalRecipients} tone="accent" />
              <StatCard label="Exportdateien" value={summary.exportFileCount} tone="accent" />
            </div>
          </section>
        ) : null}

        {downloads.length > 0 ? (
          <section style={{ borderRadius: 24, border: "1px solid #1d2024", background: "#0b0d0f", padding: 20, display: "grid", gap: 16, boxShadow: "0 24px 50px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>Downloads</h2>
              <div style={{ color: "#9aa1a9", fontSize: 14 }}>Jede Datei enthält maximal {BATCH_SIZE} Kunden. Die Dateien liegen nur als Browser-Download vor und werden nicht gespeichert.</div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {downloads.map((file) => (
                <a key={file.filename} href={file.url} download={file.filename} style={{ borderRadius: 12, border: `1px solid ${ACCENT_BORDER}`, background: ACCENT_BG, color: "#ecfdf5", textDecoration: "none", fontWeight: 900, padding: "12px 14px", display: "inline-flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span>{file.filename}</span>
                  <span style={{ color: "#a7f3d0", fontSize: 12 }}>{file.rowCount} Kunden</span>
                </a>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
