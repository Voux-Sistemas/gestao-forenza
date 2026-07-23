import React from "react";

// Símbolo da Forenza: o "O" verde da logo vira o ícone do app.
// Temável — o anel usa a cor do texto (preto no claro, branco no escuro)
// e o miolo mantém o verde da marca (--brand).
export function MarcaForenza({ size = 30, mono, corAnel }) {
  // `mono` (ex.: "#fff") força tudo numa cor; `corAnel` tinge só o anel (miolo claro).
  const cor = corAnel || mono || "var(--text)";
  const miolo = corAnel ? "#fff" : (mono ? "#6fd08a" : "var(--brand)");
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" aria-hidden="true" style={{ display: "block", color: cor, flexShrink: 0 }}>
      <circle cx="22" cy="22" r="19" stroke="currentColor" strokeWidth="4.5" />
      <circle cx="22" cy="22" r="9.5" fill={corAnel ? corAnel : miolo} />
    </svg>
  );
}

// Lockup horizontal: símbolo + "FORENZA" + legenda opcional.
export default function Logo({ size = 30, fonte = 16, legenda }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 11 }}>
      <MarcaForenza size={size} />
      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
        <span style={{ fontSize: fonte, fontWeight: 800, letterSpacing: "1.5px", color: "var(--text)" }}>
          FORENZA<sup style={{ fontSize: ".5em", fontWeight: 700, verticalAlign: "super", marginLeft: 1, color: "var(--text-3)" }}>®</sup>
        </span>
        {legenda && <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 500 }}>{legenda}</span>}
      </span>
    </span>
  );
}
