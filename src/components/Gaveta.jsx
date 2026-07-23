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
//   cor       – [r,g,b] do setor: tinge a casca (cabeçalho/rodapé) nessa cor.
//               Sem `cor`, usa o verde-claro padrão do sistema.

// Monta a "pele" (casca clara colorida) a partir de uma cor [r,g,b] do setor.
// Degradê suave claro + texto escuro na mesma matiz, legível e discreto.
export function pelePorCor(cor) {
  if (!Array.isArray(cor) || cor.length < 3) {
    // padrão: verde-claro do tema
    return { bg: "var(--zona-grad)", borda: "var(--zona-borda)", texto: "var(--text)", texto2: "var(--text-2)", marca: null };
  }
  const [r, g, b] = cor;
  const mix = (a, alvo, t) => Math.round(a + (alvo - a) * t);
  // fundo: dois tons bem claros da cor (clareia ~82% e ~72% em direção ao branco)
  const c1 = [mix(r, 255, 0.86), mix(g, 255, 0.86), mix(b, 255, 0.86)];
  const c2 = [mix(r, 255, 0.74), mix(g, 255, 0.74), mix(b, 255, 0.74)];
  const borda = [mix(r, 255, 0.55), mix(g, 255, 0.55), mix(b, 255, 0.55)];
  // texto: escurece a cor (~62% em direção ao preto) para contraste sobre o fundo claro
  const txt = [mix(r, 0, 0.55), mix(g, 0, 0.55), mix(b, 0, 0.55)];
  const txt2 = [mix(r, 0, 0.3), mix(g, 0, 0.3), mix(b, 0, 0.3)];
  const rgb = (a) => `rgb(${a[0]},${a[1]},${a[2]})`;
  return {
    bg: `linear-gradient(135deg, ${rgb(c1)}, ${rgb(c2)})`,
    borda: rgb(borda),
    texto: rgb(txt),
    texto2: rgb(txt2),
    marca: rgb([r, g, b]),   // anel da logo na cor cheia do setor
  };
}

export default function Gaveta({ children, onFechar, rodape, largura = 480, zIndex = 100, titulo, subtitulo, acaoTopo, cor, bgRodape, bgCorpo, bordaRodape, ocultarFechar = false }) {
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
  // Casca clara na cor do setor (opção C). Sem `cor`, usa o verde-claro padrão do tema.
  const pele = pelePorCor(cor);
  const corpoBg = bgCorpo ?? (temTitulo ? "var(--surface-2)" : "var(--surface)");
  const cascaBg = bgRodape ?? (temTitulo ? pele.bg : "var(--surface)");
  const cascaBorda = bordaRodape ?? (temTitulo ? pele.borda : "var(--border)");
  const corFechar = temTitulo ? pele.texto2 : "var(--text-2)";

  const botaoFechar = (
    <button onClick={onFechar} aria-label="Fechar" style={{ flexShrink: 0, width: 32, height: 32, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer", color: corFechar, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <X size={17} />
    </button>
  );

  return createPortal(
    <div onClick={onFechar} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", justifyContent: "flex-end", zIndex }}>
      <div onClick={(e) => e.stopPropagation()} className="drawer-in" style={{ position: "relative", width: `min(${largura}px, 100%)`, height: "100%", background: "var(--surface)", borderLeft: "1px solid var(--border)", boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column" }}>
        {temTitulo ? (
          <div style={{ flexShrink: 0, padding: "16px 22px", background: cascaBg, borderBottom: `1px solid ${cascaBorda}`, color: pele.texto, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0, flex: 1 }}>
              <MarcaForenza size={34} corAnel={pele.marca} />
              <div style={{ minWidth: 0 }}>
                {typeof titulo === "string" ? <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: pele.texto }}>{titulo}</h3> : titulo}
                {subtitulo && <div style={{ fontSize: 13, color: pele.texto2, marginTop: 2 }}>{subtitulo}</div>}
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
          <div style={{ flexShrink: 0, padding: "14px 22px", borderTop: `1px solid ${cascaBorda}`, background: cascaBg }}>
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
