"use client";

import { useEffect } from "react";

export default function LivePage() {
  useEffect(() => {
    window.location.replace("/dashboard");
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg,#5b21b6,#111827)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Arial, sans-serif",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "rgba(255,255,255,.10)",
          border: "1px solid rgba(255,255,255,.18)",
          borderRadius: 24,
          padding: 28,
          textAlign: "center",
          boxShadow: "0 20px 60px rgba(0,0,0,.35)",
        }}
      >
        <img
          src="/logo-oddix-horizontal.png"
          alt="ODDIX TIPSTER IA"
          style={{
            width: "100%",
            maxWidth: 280,
            height: 90,
            objectFit: "contain",
            marginBottom: 12,
          }}
        />

        <h1 style={{ margin: "0 0 8px", fontSize: 24 }}>
          Abrindo jogos ao vivo...
        </h1>

        <p style={{ margin: 0, color: "#ddd6fe", lineHeight: 1.5 }}>
          A área Ao Vivo agora fica dentro do Dashboard para evitar duplicação de código
          e manter a plataforma mais estável.
        </p>
      </div>
    </main>
  );
}
