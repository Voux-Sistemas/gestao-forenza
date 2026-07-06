import React from "react";

// Tabela fixa (somente leitura) com os tamanhos e quantidades da grade do pedido.
// Usada na gaveta de todas as etapas do quadro, no Estoque e no Histórico.
export default function GradeTabela({ grade, margem = "0 0 14px" }) {
  if (!grade || Object.keys(grade).length === 0) return null;
  const total = Object.values(grade).reduce((a, q) => a + (parseInt(q, 10) || 0), 0);
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 9, overflow: "hidden", margin: margem }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 96px", background: "var(--surface-2)", padding: "5px 11px", fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".4px" }}>
        <span>Tamanho</span><span style={{ textAlign: "right" }}>Quantidade</span>
      </div>
      {Object.entries(grade).map(([t, q]) => (
        <div key={t} style={{ display: "grid", gridTemplateColumns: "1fr 96px", padding: "4px 11px", borderTop: "1px solid var(--border)", fontSize: 12.5 }}>
          <span style={{ fontWeight: 600 }}>{t}</span>
          <span style={{ textAlign: "right", fontWeight: 700, color: "var(--accent)" }}>{q}</span>
        </div>
      ))}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 96px", padding: "4px 11px", borderTop: "1px solid var(--border)", fontSize: 12, background: "var(--surface-2)" }}>
        <span style={{ fontWeight: 700, color: "var(--text-2)" }}>Total</span>
        <span style={{ textAlign: "right", fontWeight: 700 }}>{total}</span>
      </div>
    </div>
  );
}
