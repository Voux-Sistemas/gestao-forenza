import React, { useEffect } from "react";
import { PackageCheck, PackageX, X } from "lucide-react";

const DURACAO = 6000; // ms na tela antes de sumir sozinho

// Aviso flutuante para movimentações que "somem" do quadro (Estoque e Perda).
// Puro feedback visual — não altera nada do que foi salvo.
export default function Toast({ aviso, onFechar }) {
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(onFechar, DURACAO);
    return () => clearTimeout(t);
  }, [aviso, onFechar]);

  if (!aviso) return null;
  const ehPerda = aviso.tipo === "perda";
  const cor = ehPerda ? "var(--danger)" : "var(--success)";
  const bg = ehPerda ? "var(--danger-bg)" : "var(--success-bg)";
  const Icone = ehPerda ? PackageX : PackageCheck;

  return (
    <div role="status" aria-live="polite" style={{ position: "fixed", right: 22, bottom: 22, zIndex: 120, width: "min(calc(100vw - 44px), 400px)", animation: "toastIn .35s cubic-bezier(.2,.7,.3,1) both" }}>
      <div style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, boxShadow: "var(--shadow-lg)", overflow: "hidden" }}>
        <span aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: cor }} />
        <div style={{ display: "flex", gap: 13, alignItems: "flex-start", padding: "14px 12px 13px 19px" }}>
          <span style={{ width: 42, height: 42, borderRadius: 12, background: bg, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icone size={21} strokeWidth={2} style={{ color: cor }} />
          </span>
          <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-.01em", color: "var(--text)" }}>{aviso.titulo}</span>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: cor, background: bg, padding: "2px 8px", borderRadius: 99, flexShrink: 0 }}>{ehPerda ? "Perda" : "Estoque"}</span>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 4, lineHeight: 1.5 }}>{aviso.detalhe}</div>
          </div>
          <button onClick={onFechar} aria-label="Fechar aviso" className="tap" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 6, borderRadius: 7, border: "1px solid transparent", background: "transparent", color: "var(--text-3)", cursor: "pointer", flexShrink: 0 }}>
            <X size={15} />
          </button>
        </div>
        <div style={{ height: 3, marginLeft: 4, background: "var(--surface-2)" }}>
          <div style={{ height: "100%", borderRadius: 99, background: cor, animation: `toastBar ${DURACAO}ms linear both` }} />
        </div>
      </div>
    </div>
  );
}

// Monta a mensagem certa a partir do destino da movimentação.
// Retorna null quando o destino continua visível no quadro (não precisa de aviso).
export function avisoDeMovimento(info) {
  if (!info) return null;
  const { destino, qtd, referencia } = info;
  const pecas = `${qtd} ${qtd === 1 ? "peça" : "peças"}`;
  if (destino === "Estoque") {
    return { tipo: "estoque", titulo: "Peças no estoque", detalhe: `${pecas} de ${referencia} saíram do quadro e já aguardam inspeção na aba Estoque.` };
  }
  if (destino === "Perda") {
    return { tipo: "perda", titulo: "Perda registrada", detalhe: `${pecas} de ${referencia} foram baixadas como perda e saíram do quadro.` };
  }
  return null;
}
