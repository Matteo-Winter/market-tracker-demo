export default function Loading() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#070809",
        color: "#f5f6f7",
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
            width: 46,
            height: 46,
            borderRadius: "999px",
            border: "3px solid rgba(255,255,255,0.10)",
            borderTopColor: "#a78bfa",
            animation: "bmSpin 0.9s linear infinite",
          }}
        />
        <div style={{ fontSize: 16, fontWeight: 900 }}>
          Preisvergleich lädt…
        </div>
        <div style={{ fontSize: 13, color: "#9aa1a9" }}>
          Snapshot- und Wettbewerbsdaten werden vorbereitet
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