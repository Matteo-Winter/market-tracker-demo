"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type NodeRow = {
  id: string;
  parentId: string | null;
  path: string;
  name: string;
  isLeaf: boolean;
};

const ROOT = "__root__";

export default function AddLeafForm(props: {
  defaultCategory2Id: string;
  defaultLeafName: string;

  // kommt von edit-tree/page.tsx
  category2Options: Array<{ id: string; name: string }>;

  // darf weiterhin übergeben werden – wird hier aber NICHT mehr benutzt
  parentOptionsByC2?: Record<string, any>;
}) {
  const router = useRouter();

  const [category2Id, setCategory2Id] = useState(props.defaultCategory2Id);
  const [name, setName] = useState(props.defaultLeafName);

  const [nodes, setNodes] = useState<NodeRow[]>([]);
  const [loading, setLoading] = useState(false);

  // “Ordner-Navigation”
  const [cursorId, setCursorId] = useState<string | null>(null); // wo wir gerade “drin” sind
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null); // Zielordner

  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // Nodes laden, wenn Category2 wechselt
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setOkMsg(null);
      setCursorId(null);
      setSelectedParentId(null);

      try {
        const res = await fetch(`/api/category2/${category2Id}/nodes`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error ?? `HTTP ${res.status}`);
        }
        if (!cancelled) setNodes(json.nodes ?? []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Fehler beim Laden der Nodes");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (category2Id) load();
    return () => {
      cancelled = true;
    };
  }, [category2Id]);

  const { nodeById, childrenByParent } = useMemo(() => {
    const byId = new Map<string, NodeRow>();
    const byParent = new Map<string, NodeRow[]>();

    for (const n of nodes) {
      byId.set(n.id, n);
      const pid = n.parentId ?? ROOT;
      const arr = byParent.get(pid) ?? [];
      arr.push(n);
      byParent.set(pid, arr);
    }

    // stabile Reihenfolge: nach path
    for (const [k, arr] of byParent.entries()) {
      arr.sort((a, b) => a.path.localeCompare(b.path, "de-DE"));
      byParent.set(k, arr);
    }

    return { nodeById: byId, childrenByParent: byParent };
  }, [nodes]);

  const cursorKey = cursorId ?? ROOT;
  const visibleChildren = childrenByParent.get(cursorKey) ?? [];

  // Breadcrumb (Root -> ... -> Cursor)
  const breadcrumb = useMemo(() => {
    const out: NodeRow[] = [];
    let cur = cursorId ? nodeById.get(cursorId) ?? null : null;
    while (cur) {
      out.unshift(cur);
      cur = cur.parentId ? nodeById.get(cur.parentId) ?? null : null;
    }
    return out;
  }, [cursorId, nodeById]);

  const selectedParent = selectedParentId ? nodeById.get(selectedParentId) ?? null : null;

  async function onSave() {
    setError(null);
    setOkMsg(null);

    if (!category2Id || !selectedParentId || !name?.trim()) {
      setError("Bitte Category2 wählen, einen Ziel-Ordner auswählen und Name muss gefüllt sein.");
      return;
    }

    try {
      const res = await fetch(`/api/category2/${category2Id}/add-leaf`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          parentNodeId: selectedParentId,
          name: name.trim(),
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? `HTTP ${res.status}`);
      }

      setOkMsg(`✅ gespeichert: ${json.created?.path ?? ""} — ${json.created?.name ?? ""}`);

      // Seite neu laden -> Unmapped-Liste sollte sich aktualisieren
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Fehler beim Speichern");
    }
  }

  return (
    <div style={{ marginTop: 12, border: "1px solid #2a2a2a", borderRadius: 12, padding: 12, background: "#121212" }}>
      <div style={{ fontWeight: 900, fontSize: 16 }}>Leaf hinzufügen</div>

      <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
        <div>
          <div style={{ color: "#bdbdbd", fontSize: 13, marginBottom: 6 }}>Unmapped Begriff</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #2a2a2a",
              background: "#0f0f0f",
              color: "#fff",
            }}
          />
        </div>

        <div>
          <div style={{ color: "#bdbdbd", fontSize: 13, marginBottom: 6 }}>Category2</div>
          <select
            value={category2Id}
            onChange={(e) => setCategory2Id(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #2a2a2a",
              background: "#0f0f0f",
              color: "#fff",
            }}
          >
            {props.category2Options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ borderTop: "1px solid #222", paddingTop: 10 }}>
          <div style={{ color: "#bdbdbd", fontSize: 13, marginBottom: 6 }}>
            Ziel-Ordner auswählen (klick dich wie in Ordnern rein)
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <button
              type="button"
              onClick={() => setCursorId(null)}
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid #2a2a2a",
                background: cursorId === null ? "#1a1a1a" : "#0f0f0f",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Root
            </button>

            {breadcrumb.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setCursorId(n.id)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid #2a2a2a",
                  background: cursorId === n.id ? "#1a1a1a" : "#0f0f0f",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                {n.path}
              </button>
            ))}
          </div>

          <div style={{ border: "1px solid #2a2a2a", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: 10, background: "#0f0f0f", color: "#bdbdbd", fontSize: 13 }}>
              {loading ? "lade…" : `Einträge in dieser Ebene: ${visibleChildren.length}`}
            </div>

            {visibleChildren.length === 0 ? (
              <div style={{ padding: 10, color: "#9a9a9a" }}>
                Keine Unterordner / Einträge auf dieser Ebene.
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                  Tipp: wähle einen anderen Pfad oben (Breadcrumb).
                </div>
              </div>
            ) : (
              <div>
                {visibleChildren.map((n) => {
                  const isSelected = selectedParentId === n.id;
                  return (
                    <div
                      key={n.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        padding: 10,
                        borderTop: "1px solid #222",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: "monospace", color: "#cfcfcf" }}>
                          {n.path}{" "}
                          <span style={{ color: "#9a9a9a" }}>
                            {n.isLeaf ? "(Leaf)" : "(Ordner)"}
                          </span>
                        </div>
                        <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.name}</div>
                      </div>

                      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => setCursorId(n.id)}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 10,
                            border: "1px solid #2a2a2a",
                            background: "#0f0f0f",
                            color: "#fff",
                            cursor: "pointer",
                          }}
                        >
                          öffnen
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedParentId(n.id)}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 10,
                            border: "1px solid #2a2a2a",
                            background: isSelected ? "#1a1a1a" : "#0f0f0f",
                            color: "#fff",
                            cursor: "pointer",
                          }}
                        >
                          {isSelected ? "✓ gewählt" : "wählen"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ marginTop: 10, color: "#bdbdbd", fontSize: 13 }}>
            Zielordner:{" "}
            {selectedParent ? (
              <span style={{ color: "#fff" }}>
                <b>{selectedParent.path}</b> — {selectedParent.name}
              </span>
            ) : (
              <span>– (bitte “wählen” klicken)</span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onSave}
          disabled={loading || !selectedParentId || !name.trim()}
          style={{
            marginTop: 6,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #2a2a2a",
            background: loading || !selectedParentId || !name.trim() ? "#0f0f0f" : "#1a1a1a",
            color: "#fff",
            cursor: loading || !selectedParentId || !name.trim() ? "not-allowed" : "pointer",
            fontWeight: 800,
          }}
        >
          Speichern
        </button>

        {error ? <div style={{ color: "#ff6b6b", fontSize: 13 }}>❌ {error}</div> : null}
        {okMsg ? <div style={{ color: "#7CFC9A", fontSize: 13 }}>{okMsg}</div> : null}
      </div>
    </div>
  );
}