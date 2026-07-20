import React from "react";

// Indicador do sistema: rótulo à esquerda, ícone num chip com a cor do tema à
// direita, número em destaque e uma linha de contexto opcional embaixo.
// `cor` = cor do ícone; `corBg` = fundo do chip (tinta do tema). Sem corBg,
// o chip fica neutro (surface-2), mantendo compatibilidade nas outras telas.
export default function StatCard({ label, valor, sub, subCor, cor = "var(--text-3)", corBg, Icon, valorCor }) {
  return (
    <div className="lift" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px", boxShadow: "var(--shadow-sm)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 13, gap: 8 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
        {Icon && (
          <span style={{ width: 30, height: 30, borderRadius: 9, background: corBg || "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon size={16} strokeWidth={2} style={{ color: cor }} />
          </span>
        )}
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, letterSpacing: "-.02em", color: valorCor || "var(--text)" }}>{valor}</div>
      {sub && <div style={{ fontSize: 11.5, color: subCor || "var(--text-3)", marginTop: 8 }}>{sub}</div>}
    </div>
  );
}
