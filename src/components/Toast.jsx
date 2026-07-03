import React, { useEffect } from "react";
import { Boxes, Trash2, X } from "lucide-react";

const DURACAO = 5500; // ms na tela antes de sumir sozinho

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
  const Icone = ehPerda ? Trash2 : Boxes;

  return (
    <div role="status" aria-live="polite" style={{ position: "fixed", top: 76, left: "50%", zIndex: 100, width: "min(92vw, 430px)", animation: "toastIn .32s cubic-bezier(.2,.7,.3,1) both" }}>
      <div style={{ background: "var(--surface)", border: `1.5px solid ${cor}`, borderRadius: 14, boxShadow: "var(--shadow-lg)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px" }}>
          <span style={{ width: 40, height: 40, borderRadius: 11, background: bg, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icone size={19} style={{ color: cor }} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: cor }}>{aviso.titulo}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 2, lineHeight: 1.4 }}>{aviso.detalhe}</div>
          </div>
          <button onClick={onFechar} aria-label="Fechar aviso" className="tap" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 6, borderRadius: 7, border: "1px solid transparent", background: "transparent", color: "var(--text-3)", cursor: "pointer", flexShrink: 0 }}>
            <X size={15} />
          </button>
        </div>
        <div style={{ height: 3, background: bg }}>
          <div style={{ height: "100%", background: cor, animation: `toastBar ${DURACAO}ms linear both` }} />
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
    return { tipo: "estoque", titulo: "Enviado para o Estoque ✓", detalhe: `${pecas} de ${referencia} saíram do quadro e aguardam inspeção na aba Estoque.` };
  }
  if (destino === "Perda") {
    return { tipo: "perda", titulo: "Registrado como Perda", detalhe: `${pecas} de ${referencia} foram baixadas como perda e saíram do quadro.` };
  }
  return null;
}
