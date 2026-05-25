"use client";

import { useRouter } from "next/navigation";

export default function BackButton({
  fallbackHref,
  label = "← zurück",
}: {
  fallbackHref: string;
  label?: string;
}) {
  const router = useRouter();

  function goBack() {
    // Wenn es eine History gibt → zurück
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    // Sonst fallback (z.B. wenn man Seite in neuem Tab öffnet)
    router.push(fallbackHref);
  }

  return (
    <button
      onClick={goBack}
      style={{
        color: "#bdbdbd",
        textDecoration: "underline",
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
        fontSize: 14,
      }}
    >
      {label}
    </button>
  );
}