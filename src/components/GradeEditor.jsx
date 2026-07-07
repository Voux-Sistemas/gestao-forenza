import React from "react";
import { Plus, X } from "lucide-react";
import { TAMANHOS_GRADE } from "./GradeTabela.jsx";

// Editor da grade no estilo da ficha física: variantes (linhas) × tamanhos numerados.
// Controlado: recebe `valor` (array de {variante, qtds}) e devolve por `onChange`.
export default function GradeEditor({ valor, onChange }) {
  const linhas = valor && valor.length ? valor : [{ variante: "", qtds: {} }];

  const set = (novas) => onChange(novas);
  const mudarQtd = (i, t, v) => set(linhas.map((l, j) => j === i ? { ...l, qtds: { ...l.qtds, [t]: v } } : l));
  const mudarVar = (i, v) => set(linhas.map((l, j) => j === i ? { ...l, variante: v } : l));
  const addLinha = () => set([...linhas, { variante: "", qtds: {} }]);
  const removerLinha = (i) => set(linhas.length > 1 ? linhas.filter((_, j) => j !== i) : linhas);

  const somaLinha = (l) => TAMANHOS_GRADE.reduce((a, t) => a + (parseInt(l.qtds[t], 10) || 0), 0);
  const totalTam = (t) => linhas.reduce((a, l) => a + (parseInt(l.qtds[t], 10) || 0), 0);
  const geral = linhas.reduce((a, l) => a + somaLinha(l), 0);

  const cel = { border: "1px solid var(--border)", padding: 0, textAlign: "center" };
  const th = { ...cel, background: "var(--surface-2)", padding: "6px 3px", fontSize: 9.5, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".3px", minWidth: 48 };
  const inpCel = { width: "100%", border: "none", background: "transparent", textAlign: "center", fontSize: 12.5, padding: "6px 2px", color: "var(--text)", fontFamily: "inherit", outline: "none" };

  return (
    <div>
      <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 9 }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left", padding: "6px 9px", minWidth: 104 }}>VARIANTE</th>
              {TAMANHOS_GRADE.map((t) => <th key={t} style={th}>{t}</th>)}
              <th style={{ ...th, background: "var(--surface-3)", color: "var(--text-2)" }}>TOTAL</th>
              <th style={{ ...th, width: 30 }}></th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i}>
                <td style={{ ...cel, textAlign: "left" }}>
                  <input value={l.variante} onChange={(e) => mudarVar(i, e.target.value)} placeholder="cor / variante" style={{ ...inpCel, textAlign: "left", padding: "6px 9px", fontWeight: 600 }} />
                </td>
                {TAMANHOS_GRADE.map((t) => (
                  <td key={t} style={cel}>
                    <input type="number" min="0" value={l.qtds[t] ?? ""} onChange={(e) => mudarQtd(i, t, e.target.value)} placeholder="—" style={inpCel} />
                  </td>
                ))}
                <td style={{ ...cel, background: "var(--surface-2)", fontWeight: 700, fontSize: 13 }}>{somaLinha(l)}</td>
                <td style={cel}>
                  <button type="button" onClick={() => removerLinha(i)} disabled={linhas.length === 1} aria-label="Remover variante" style={{ display: "inline-flex", border: "none", background: "none", color: "var(--text-3)", cursor: linhas.length === 1 ? "not-allowed" : "pointer", padding: 5, opacity: linhas.length === 1 ? 0.4 : 1 }}><X size={13} /></button>
                </td>
              </tr>
            ))}
            <tr style={{ background: "var(--surface-2)" }}>
              <td style={{ ...cel, textAlign: "left", padding: "6px 9px", fontSize: 11.5, fontWeight: 700, color: "var(--text-2)" }}>TOTAL</td>
              {TAMANHOS_GRADE.map((t) => <td key={t} style={{ ...cel, fontSize: 12.5, fontWeight: 700, color: totalTam(t) ? "var(--accent)" : "var(--text-3)" }}>{totalTam(t) || ""}</td>)}
              <td style={{ ...cel, background: "var(--accent-bg)", color: "var(--accent)", fontSize: 14, fontWeight: 800 }}>{geral}</td>
              <td style={cel}></td>
            </tr>
          </tbody>
        </table>
      </div>
      <button type="button" onClick={addLinha} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 9, padding: "7px 13px", fontSize: 12.5, fontWeight: 600, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer" }}>
        <Plus size={14} /> Adicionar variante
      </button>
    </div>
  );
}

// Limpa a grade para salvar: remove linhas/tamanhos vazios. Retorna null se ficou vazia.
export function limparGrade(linhas) {
  const limpa = (linhas || [])
    .map((l) => ({ variante: (l.variante || "").trim(), qtds: Object.fromEntries(TAMANHOS_GRADE.map((t) => [t, parseInt(l.qtds[t], 10) || 0]).filter(([, q]) => q > 0)) }))
    .filter((l) => Object.keys(l.qtds).length);
  return limpa.length ? limpa : null;
}
