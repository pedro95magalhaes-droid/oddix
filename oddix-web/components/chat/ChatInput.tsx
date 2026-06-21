"use client";

import { useState } from "react";

type Props = {
  disabled?: boolean;
  onSend: (message: string) => void;
};

export default function ChatInput({ disabled, onSend }: Props) {
  const [value, setValue] = useState("");

  function handleSubmit() {
    const text = value.trim();

    if (!text || disabled) return;

    onSend(text);
    setValue("");
  }

  return (
    <div style={styles.wrap}>
      <textarea
        value={value}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            handleSubmit();
          }
        }}
        placeholder="Pergunte qualquer coisa sobre futebol..."
        style={styles.input}
      />

      <button disabled={disabled} onClick={handleSubmit} style={styles.button}>
        {disabled ? "..." : "Enviar"}
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: "flex",
    gap: 10,
    padding: 16,
    borderTop: "1px solid rgba(255,255,255,.08)",
    background: "rgba(5,5,5,.96)",
  },
  input: {
    flex: 1,
    minHeight: 52,
    maxHeight: 140,
    resize: "none",
    border: "1px solid rgba(250,204,21,.20)",
    background: "rgba(255,255,255,.045)",
    color: "#fff",
    borderRadius: 16,
    padding: "14px 16px",
    outline: "none",
    fontWeight: 700,
  },
  button: {
    border: 0,
    background: "#facc15",
    color: "#050505",
    borderRadius: 16,
    padding: "0 18px",
    fontWeight: 1000,
    cursor: "pointer",
  },
};