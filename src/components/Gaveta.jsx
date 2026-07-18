import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// Gaveta lateral padrão do sistema — substitui os modais centralizados.
// Renderiza via portal no <body>, por isso nunca fica presa atrás do cabeçalho.
// Props:
//   onFechar  – chamado ao clicar fora, no ✕ ou apertar Esc
//   rodape    – conteúdo fixo na base (botões de ação), sempre visível
//   largura   – largura máxima em px (padrão 480)
//   zIndex    – para empilhar gavetas (padrão 100)
export default function Gaveta({ children, onFechar, rodape, largura = 480, zIndex = 100, bgRodape = "var(--surface)" }) {
  // Trava a rolagem da página enquanto a gaveta está aberta.
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = anterior; };
  }, []);

  // Fecha com a tecla Esc.
  useEffect(() => {
    const aoTeclar = (e) => { if (e.key === "Escape") onFechar?.(); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  return createPortal(
    <div onClick={onFechar} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", justifyContent: "flex-end", zIndex }}>
      <div onClick={(e) => e.stopPropagation()} className="drawer-in" style={{ position: "relative", width: `min(${largura}px, 100%)`, height: "100%", background: "var(--surface)", borderLeft: "1px solid var(--border)", boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column" }}>
        <button onClick={onFechar} aria-label="Fechar" style={{ position: "absolute", top: 14, right: 16, zIndex: 1, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: 6, cursor: "pointer", color: "var(--text-3)", display: "flex", alignItems: "center" }}>
          <X size={15} />
        </button>
        <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", padding: 22 }}>
          {children}
        </div>
        {rodape && (
          <div style={{ flexShrink: 0, padding: "14px 22px", borderTop: "1px solid var(--border)", background: bgRodape }}>
            {rodape}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
