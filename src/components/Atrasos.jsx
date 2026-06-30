import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient.js";
import { Printer, AlertTriangle, AlertCircle, Clock, Calendar, CheckCircle2 } from "lucide-react";
import StatCard from "./StatCard.jsx";

const PRODUCAO = ["Entrada", "Corte", "Oficina", "Acabamento"];

function saldos(pedidoId, total, movimentos) {
  const s = { Entrada: total, Corte: 0, Oficina: 0, Acabamento: 0, Estoque: 0, Perda: 0 };
  for (const m of movimentos) {
    if (m.pedido_id !== pedidoId) continue;
    s[m.de_local] -= m.qtd;
    s[m.para_local] += m.qtd;
  }
  return s;
}

function diasAte(prazo) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const [y, m, d] = prazo.split("-").map(Number);
  const alvo = new Date(y, m - 1, d);
  return Math.round((alvo - hoje) / 86400000);
}

function textoDias(dias) {
  if (dias < 0) return `venceu há ${-dias} ${-dias === 1 ? "dia" : "dias"}`;
  if (dias === 0) return "vence hoje";
  if (dias === 1) return "vence amanhã";
  return `faltam ${dias} dias`;
}

function formatarData(prazo) {
  const [y, m, d] = prazo.split("-");
  return `${d}/${m}/${y}`;
}

export default function Atrasos() {
  const [pedidos, setPedidos] = useState([]);
  const [movimentos, setMovimentos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    const [p, m, c] = await Promise.all([
      supabase.from("pedidos").select("*"),
      supabase.from("movimentos").select("*"),
      supabase.from("clientes").select("*"),
    ]);
    setPedidos(p.data || []); setMovimentos(m.data || []); setClientes(c.data || []);
    setCarregando(false);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const nomeCliente = (id) => clientes.find((c) => c.id === id)?.nome || "—";

  if (carregando) return <div style={{ padding: 28, color: "var(--text-2)" }}>Carregando…</div>;

  const alertas = [];
  for (const pe of pedidos) {
    if (!pe.prazo) continue;
    const s = saldos(pe.id, pe.total, movimentos);
    const emProducao = PRODUCAO.reduce((acc, l) => acc + s[l], 0);
    if (emProducao <= 0) continue;
    const dias = diasAte(pe.prazo);
    if (dias > 2) continue;
    const locais = PRODUCAO.filter((l) => s[l] > 0).map((l) => ({ local: l, qtd: s[l] }));
    const concluido = pe.total - emProducao;
    const pct = Math.round((concluido / pe.total) * 100);
    alertas.push({ pe, dias, emProducao, concluido, pct, locais });
  }

  const grupos = [
    { id: "atr", titulo: "Atrasados", itens: alertas.filter((a) => a.dias < 0).sort((a, b) => a.dias - b.dias), cor: "var(--danger)", bg: "var(--danger-bg)", icone: AlertCircle },
    { id: "cri", titulo: "Críticos · hoje e amanhã", itens: alertas.filter((a) => a.dias === 0 || a.dias === 1).sort((a, b) => a.dias - b.dias), cor: "var(--orange)", bg: "var(--orange-bg)", icone: AlertTriangle },
    { id: "ate", titulo: "Atenção · 2 dias", itens: alertas.filter((a) => a.dias === 2), cor: "var(--warning)", bg: "var(--warning-bg)", icone: Clock },
  ];

  const vazio = alertas.length === 0;

  const kpis = [
    { label: "Total em alerta", valor: alertas.length, cor: "var(--text)", bg: "var(--surface-2)", Icon: AlertTriangle, iconCor: "var(--text-2)" },
    { label: "Atrasados", valor: grupos[0].itens.length, cor: "var(--danger)", bg: "var(--danger-bg)", Icon: AlertCircle, iconCor: "var(--danger)" },
    { label: "Críticos", valor: grupos[1].itens.length, cor: "var(--orange)", bg: "var(--orange-bg)", Icon: AlertTriangle, iconCor: "var(--orange)" },
    { label: "Atenção", valor: grupos[2].itens.length, cor: "var(--warning)", bg: "var(--warning-bg)", Icon: Clock, iconCor: "var(--warning)" },
  ];

  return (
    <div className="fade-in" style={{ padding: "20px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Alertas</h2>
          <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 3 }}>Pedidos em produção que vencem em até 2 dias.</div>
        </div>
        <button onClick={() => window.print()} style={btnGhost}><Printer size={15} /> Imprimir</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        {kpis.map((k) => (
          <StatCard key={k.label} label={k.label} valor={k.valor} cor={k.cor} Icon={k.Icon} />
        ))}
      </div>

      {vazio ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "52px 0", color: "var(--text-2)" }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: "var(--success-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CheckCircle2 size={28} style={{ color: "var(--success)" }} />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>Tudo dentro do prazo</div>
            <div style={{ fontSize: 13, marginTop: 3 }}>Nenhum pedido em alerta no momento.</div>
          </div>
        </div>
      ) : grupos.map((g) => {
        if (g.itens.length === 0) return null;
        const Icone = g.icone;
        return (
          <div key={g.id} style={{ marginBottom: 26 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 12, padding: "5px 12px", borderRadius: 99, background: g.bg }}>
              <Icone size={15} style={{ color: g.cor }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: g.cor }}>{g.titulo}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: g.cor, opacity: 0.7 }}>· {g.itens.length}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 360px), 1fr))", gap: 12 }}>
              {g.itens.map(({ pe, dias, emProducao, pct, locais }) => (
                <div key={pe.id} className="lift" style={{ ...cartao, borderLeft: `3px solid ${g.cor}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 600 }}>{pe.referencia}</span>
                        {pe.marca && <span style={tag}>{pe.marca}</span>}
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 2 }}>{nomeCliente(pe.cliente_id)}</div>
                    </div>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: g.cor, background: g.bg, padding: "4px 10px", borderRadius: 99, whiteSpace: "nowrap" }}>{textoDias(dias)}</span>
                  </div>

                  <div style={{ height: 8, background: "var(--surface-3)", borderRadius: 99, overflow: "hidden", marginTop: 14 }}>
                    <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: "linear-gradient(90deg,var(--success),#28A56F)", transition: "width .4s cubic-bezier(.2,.7,.3,1)" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 8 }}>
                    <span style={{ fontSize: 13 }}>
                      <strong style={{ fontWeight: 700 }}>Faltam {emProducao}</strong> <span style={{ color: "var(--text-3)" }}>de {pe.total} peças</span>
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>{pct}%</span>
                  </div>

                  {locais.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                      {locais.map((l) => (
                        <span key={l.local} style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-2)", background: "var(--surface-2)", border: "1px solid var(--border)", padding: "3px 9px", borderRadius: 99 }}>
                          {l.local} <strong style={{ color: "var(--text)" }}>{l.qtd}</strong>
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-3)", marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                    <Calendar size={13} /> Prazo: {formatarData(pe.prazo)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const btnGhost = { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", fontSize: 13, fontWeight: 600, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer" };
const cartao = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px", boxShadow: "var(--shadow-card)" };
const tag = { fontSize: 10.5, fontWeight: 600, borderRadius: 99, padding: "2px 8px", color: "var(--accent)", background: "var(--accent-bg)", whiteSpace: "nowrap" };
