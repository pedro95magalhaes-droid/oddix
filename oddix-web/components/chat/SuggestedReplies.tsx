"use client";

type Props = {
  suggestions?: string[];
  disabled?: boolean;
  onSelect: (text: string) => void;
};

export default function SuggestedReplies({ suggestions, disabled, onSelect }: Props) {
  if (!suggestions?.length) return null;

  return (
    <div style={styles.wrap}>
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          disabled={disabled}
          onClick={() => onSelect(suggestion)}
          style={styles.button}
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: -6,
    marginBottom: 18,
    paddingLeft: 8,
  },
  button: {
    border: "1px solid rgba(250,204,21,.24)",
    background: "rgba(250,204,21,.08)",
    color: "#facc15",
    borderRadius: 999,
    padding: "9px 13px",
    fontWeight: 900,
    cursor: "pointer",
  },
};