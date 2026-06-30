import React from "react";

// Indicador enxuto e tipográfico — sem o "tile colorido" de dashboard genérico.
// Um ponto de cor carrega a semântica; o ícone fica discreto; o número é o herói.
export default function StatCard({ label, valor, sub, subCor, cor = "var(--text-3)", Icon, valorCor }) {
  return (
    <div className="lift" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 13, padding: "15px 17px 16px", boxShadow: "var(--shadow-sm)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
        <span style={{ width: 7, height: 7, borderRadius: 99, background: cor, flexShrink: 0 }} />
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
        {Icon && <Icon size={15} strokeWidth={2} style={{ marginLeft: "auto", color: "var(--text-3)", flexShrink: 0 }} />}
      </div>
      <div style={{ fontSize: 29, fontWeight: 800, lineHeight: 1, letterSpacing: "-.02em", color: valorCor || "var(--text)" }}>{valor}</div>
      {sub && <div style={{ fontSize: 11.5, color: subCor || "var(--text-3)", marginTop: 8 }}>{sub}</div>}
    </div>
  );
}
