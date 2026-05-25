"use client";

import { useRouter } from "next/navigation";

const KEY = "marketTracker.runContext";

export default function RunContextNav(props: {
  href: string;
  label: string;
  runId: string;
  mainCategorySlug: string;
  category2Id: string;
}) {
  const router = useRouter();

  function go() {
    const payload = {
      runId: props.runId,
      mainCategorySlug: props.mainCategorySlug,
      category2Id: props.category2Id,
      ts: Date.now(),
    };
    try {
      sessionStorage.setItem(KEY, JSON.stringify(payload));
    } catch {}
    router.push(props.href);
  }

  return (
    <button
      onClick={go}
      style={{
        color: "#fff",
        textDecoration: "underline",
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
      }}
    >
      {props.label}
    </button>
  );
}