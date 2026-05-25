export default function Loading() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#050505",
        color: "#f8fafc",
        padding: 24,
      }}
    >
      <div
        style={{
          display: "grid",
          justifyItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "999px",
            border: "3px solid rgba(255,255,255,0.12)",
            borderTopColor: "#60a5fa",
            animation: "bmSpin 0.9s linear infinite",
          }}
        />
        <div style={{ fontSize: 16, fontWeight: 800 }}>Market Tracker lädt…</div>
        <div style={{ fontSize: 13, color: "#a1a1aa" }}>
          Daten werden vorbereitet
        </div>
      </div>

      <style>{`
        @keyframes bmSpin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </main>
  );
}