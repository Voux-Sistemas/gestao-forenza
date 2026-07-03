import React from "react";
import { Receipt } from "lucide-react";

// Página em construção — o conteúdo (quais contas, campos e fluxos) será definido em seguida.
export default function ContasAPagar() {
  return (
    <div className="fade-in" style={{ padding: 28, maxWidth: 1280, margin: "0 auto" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>Contas a Pagar</h2>
      <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 24px" }}>Controle financeiro de pagamentos.</p>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "72px 24px", background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 14, textAlign: "center" }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--accent-bg)", color: "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Receipt size={24} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Em construção</div>
        <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0, maxWidth: 380 }}>
          Esta área vai receber o controle de contas a pagar. Em breve você poderá cadastrar e acompanhar os pagamentos por aqui.
        </p>
      </div>
    </div>
  );
}
