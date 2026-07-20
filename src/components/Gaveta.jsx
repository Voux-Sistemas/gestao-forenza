import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { MarcaForenza } from "./Logo.jsx";

// Gaveta lateral padrão do sistema — substitui os modais centralizados.
// Renderiza via portal no <body>, por isso nunca fica presa atrás do cabeçalho.
//
// Padrão visual unificado: quando `titulo` é informado, a gaveta desenha
// sozinha a faixa verde no topo (com título/subtítulo/ação), o corpo cinza
// e o rodapé verde. O conteúdo deve ser organizado em blocos brancos <Bloco>.
//
// Props:
//   titulo    – título da gaveta (string ou nó). Liga a "casca" verde+cinza.
//   subtitulo – linha auxiliar sob o título (ex.: "400 peças em Corte")
//   acaoTopo  – nó opcional no canto direito do topo (ex.: botão PDF)
//   onFechar  – chamado ao clicar fora, no ✕ ou apertar Esc
//   rodape    – conteúdo fixo na base (botões de ação), sempre visível
//   largura   – largura máxima em px (padrão 480)
//   zIndex    – para empilhar gavetas (padrão 100)
//   bgCorpo/bgRodape/bordaRodape – sobrescrevem a casca padrão, se preciso
export default function Gaveta({ children, onFechar, rodape, largura = 480, zIndex = 100, titulo, subtitulo, acaoTopo, bgRodape, bgCorpo, bordaRodape, ocultarFechar = false }) {
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

  const temTitulo = titulo != null;
  const corpoBg = bgCorpo ?? (temTitulo ? "var(--surface-2)" : "var(--surface)");
  const rodapeBg = bgRodape ?? (temTitulo ? "var(--zona-grad)" : "var(--surface)");
  const rodapeBorda = bordaRodape ?? (temTitulo ? "var(--zona-borda)" : "var(--border)");

  const botaoFechar = (
    <button onClick={onFechar} aria-label="Fechar" style={{ flexShrink: 0, width: 32, height: 32, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer", color: "var(--text-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <X size={17} />
    </button>
  );

  return createPortal(
    <div onClick={onFechar} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", justifyContent: "flex-end", zIndex }}>
      <div onClick={(e) => e.stopPropagation()} className="drawer-in" style={{ position: "relative", width: `min(${largura}px, 100%)`, height: "100%", background: "var(--surface)", borderLeft: "1px solid var(--border)", boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column" }}>
        {temTitulo ? (
          <div style={{ flexShrink: 0, padding: "16px 22px", background: "var(--zona-grad)", borderBottom: "1px solid var(--zona-borda)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0, flex: 1 }}>
              <MarcaForenza size={34} />
              <div style={{ minWidth: 0 }}>
                {typeof titulo === "string" ? <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{titulo}</h3> : titulo}
                {subtitulo && <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2 }}>{subtitulo}</div>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
              {acaoTopo}
              {botaoFechar}
            </div>
          </div>
        ) : ocultarFechar ? null : (
          <div style={{ position: "absolute", top: 14, right: 16, zIndex: 1 }}>{botaoFechar}</div>
        )}
        <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", padding: 22, background: corpoBg }}>
          {children}
        </div>
        {rodape && (
          <div style={{ flexShrink: 0, padding: "14px 22px", borderTop: `1px solid ${rodapeBorda}`, background: rodapeBg }}>
            {rodape}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// Cartão branco padrão do miolo das gavetas (o "bloco").
export function Bloco({ children, style, titulo }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", marginBottom: 12, ...style }}>
      {titulo && <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 10 }}>{titulo}</div>}
      {children}
    </div>
  );
}
