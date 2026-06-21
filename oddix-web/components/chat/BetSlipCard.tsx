"use client";

type Selection = {
  game: string;
  markets: string[];
  odd: number;
  confidence: number;
  risk: string;
  seal: string;
  reason: string;
};

type Ticket = {
  type: "simple" | "multiple" | "player_props";
  title: string;
  oddTotal: number;
  confidence: number;
  risk: string;
  status: string;
  selections: Selection[];
};

type Props = {
  ticket?: Ticket;
};

function formatSeal(seal?: string) {
  if (seal === "ELITE") return "👑 ELITE";
  if (seal === "SEGURA") return "🟢 SEGURA";
  if (seal === "BOA") return "🟡 BOA";
  if (seal === "ARRISCADA") return "🟠 ARRISCADA";
  return "🔴 REPROVADA";
}

export default function BetSlipCard({ ticket }: Props) {
  if (!ticket?.selections?.length) return null;

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div>
          <span style={styles.kicker}>BILHETE ODDIX IA</span>
          <h3 style={styles.title}>{ticket.title}</h3>
        </div>

        <div style={styles.oddBox}>
          <span>Odd Total</span>
          <strong>{Number(ticket.oddTotal || 0).toFixed(2)}</strong>
        </div>
      </div>

      <div style={styles.summary}>
        <div>
          <span>Confiança</span>
          <strong>{ticket.confidence}%</strong>
        </div>

        <div>
          <span>Risco</span>
          <strong>{ticket.risk}</strong>
        </div>

        <div>
          <span>Status</span>
          <strong>{ticket.status}</strong>
        </div>
      </div>

      <div style={styles.list}>
        {ticket.selections.map((selection, index) => (
          <div key={`${selection.game}-${index}`} style={styles.selection}>
            <div style={styles.selectionTop}>
              <strong>
                {index + 1}️⃣ {selection.game}
              </strong>
              <span style={styles.seal}>{formatSeal(selection.seal)}</span>
            </div>

            <div style={styles.markets}>
              {selection.markets.map((market) => (
                <span key={market}>✅ {market}</span>
              ))}
            </div>

            <div style={styles.selectionStats}>
              <span>Odd {Number(selection.odd || 0).toFixed(2)}</span>
              <span>Confiança {selection.confidence}%</span>
              <span>Risco {selection.risk}</span>
            </div>

            <p style={styles.reason}>{selection.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    marginTop: 12,
    marginBottom: 20,
    border: "1px solid rgba(250,204,21,.30)",
    borderRadius: 24,
    background:
      "radial-gradient(circle at 10% 0%, rgba(250,204,21,.16), transparent 35%), rgba(8,8,8,.94)",
    boxShadow: "0 24px 70px rgba(0,0,0,.35)",
    overflow: "hidden",
  },
  header: {
    padding: 18,
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    borderBottom: "1px solid rgba(255,255,255,.08)",
  },
  kicker: {
    color: "#facc15",
    fontSize: 11,
    fontWeight: 1000,
    letterSpacing: 1,
  },
  title: {
    margin: "5px 0 0",
    fontSize: 22,
  },
  oddBox: {
    border: "1px solid rgba(250,204,21,.30)",
    borderRadius: 16,
    padding: "10px 14px",
    minWidth: 105,
    textAlign: "center",
    color: "#facc15",
  },
  summary: {
    display: "grid",
    gridTemplateColumns: "repeat(3,1fr)",
    gap: 10,
    padding: 14,
  },
  list: {
    display: "grid",
    gap: 12,
    padding: 14,
  },
  selection: {
    border: "1px solid rgba(255,255,255,.10)",
    borderRadius: 18,
    padding: 14,
    background: "rgba(255,255,255,.045)",
  },
  selectionTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
  },
  seal: {
    color: "#facc15",
    fontWeight: 1000,
    fontSize: 12,
    whiteSpace: "nowrap",
  },
  markets: {
    display: "grid",
    gap: 5,
    marginTop: 12,
    color: "#fff",
    fontWeight: 800,
  },
  selectionStats: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
    color: "#facc15",
    fontWeight: 900,
    fontSize: 13,
  },
  reason: {
    margin: "10px 0 0",
    color: "rgba(255,255,255,.72)",
    lineHeight: 1.5,
    fontWeight: 700,
  },
};