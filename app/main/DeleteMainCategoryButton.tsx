"use client";

import { useRouter } from "next/navigation";

export default function DeleteMainCategoryButton({
  mainCategoryId,
  label = "Löschen",
}: {
  mainCategoryId: string;
  label?: string;
}) {
  const router = useRouter();

  return (
    <button
      onClick={async () => {
        const ok = confirm("MainCategory in den Papierkorb verschieben? (Kannst du später im Papierkorb final löschen)");
        if (!ok) return;

        const res = await fetch(`/api/main/by-id/${mainCategoryId}/delete`, { method: "POST" });
        const txt = await res.text();
        if (!res.ok) {
          alert(`Fehler (${res.status}): ${txt}`);
          return;
        }
        router.refresh();
      }}
      style={{
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid #5a1f1f",
        background: "#2a0f0f",
        color: "#ffbdbd",
        cursor: "pointer",
        fontWeight: 800,
      }}
    >
      {label}
    </button>
  );
}