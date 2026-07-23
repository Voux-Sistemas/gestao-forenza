import React, { useState } from "react";

// Calendário de intervalo (início → fim) reutilizável.
// Usado no filtro de Período do Controle de Oficinas e no painel Tabela.

const MESES_CAL = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIAS_CAL = ["D", "S", "T", "Q", "Q", "S", "S"];
const pad2 = (n) => String(n).padStart(2, "0");
export const ymd = (dt) => `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
export const parseYmd = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

export function CalendarioRange({ de, ate, onChange }) {
  const [ref, setRef] = useState(() => (de ? parseYmd(de) : new Date()));
  const ano = ref.getFullYear(), mes = ref.getMonth();
  const primeiro = new Date(ano, mes, 1);
  const inicioGrid = new Date(ano, mes, 1 - primeiro.getDay());
  const dias = Array.from({ length: 42 }, (_, i) => { const d = new Date(inicioGrid); d.setDate(inicioGrid.getDate() + i); return d; });
  const deD = de ? parseYmd(de) : null;
  const ateD = ate ? parseYmd(ate) : null;
  const hojeStr = ymd(new Date());

  function clicar(d) {
    const s = ymd(d);
    if (!de || (de && ate)) { onChange(s, ""); return; }   // começa novo intervalo
    if (parseYmd(s) < deD) onChange(s, de);                 // clicou antes do início → inverte
    else onChange(de, s);                                   // fecha o intervalo
  }

  const navBtn = { width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer", fontSize: 15, lineHeight: 1 };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, textTransform: "capitalize" }}>{MESES_CAL[mes]} de {ano}</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={() => setRef(new Date(ano, mes - 1, 1))} style={navBtn} aria-label="Mês anterior">‹</button>
          <button type="button" onClick={() => setRef(new Date(ano, mes + 1, 1))} style={navBtn} aria-label="Próximo mês">›</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {DIAS_CAL.map((d, i) => <div key={i} style={{ textAlign: "center", fontSize: 10.5, fontWeight: 700, color: "var(--text-3)", padding: "2px 0" }}>{d}</div>)}
        {dias.map((d, i) => {
          const s = ymd(d);
          const doMes = d.getMonth() === mes;
          const ehInicio = de && s === de;
          const ehFim = ate && s === ate;
          const noMeio = deD && ateD && d > deD && d < ateD;
          const selecionado = ehInicio || ehFim;
          return (
            <button key={i} type="button" onClick={() => clicar(d)}
              style={{
                height: 30, border: "none", cursor: "pointer", fontSize: 12.5,
                borderRadius: selecionado ? 8 : noMeio ? 0 : 8,
                background: selecionado ? "var(--accent)" : noMeio ? "var(--accent-bg)" : "transparent",
                color: selecionado ? "#fff" : !doMes ? "var(--text-3)" : "var(--text)",
                fontWeight: selecionado || s === hojeStr ? 700 : 400,
                outline: s === hojeStr && !selecionado ? "1px solid var(--accent)" : "none",
                opacity: doMes ? 1 : 0.5,
              }}>
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
