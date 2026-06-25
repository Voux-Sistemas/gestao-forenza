import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient.js";
import { Printer, AlertTriangle, Clock } from "lucide-react";

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
    const onde = PRODUCAO.filter((l) => s[l] > 0).map((l) => `${l} ${s[l]}`).join(" · ");
    alertas.push({ pe, dias, emProducao, onde });
  }

  const grupos = [
    { titulo: "Atrasados", itens: alertas.filter((a) => a.dias < 0).sort((a, b) => a.dias - b.dias), cor: "var(--danger)", icone: AlertTriangle },
    { titulo: "Críticos (hoje / amanhã)", itens: alertas.filter((a) => a.dias === 0 || a.dias === 1).sort((a, b) => a.dias - b.dias), cor: "var(--danger)", icone: AlertTriangle },
    { titulo: "Atenção (2 dias)", itens: alertas.filter((a) => a.dias === 2), cor: "var(--warning)", icone: Clock },
  ];

  const vazio = alertas.length === 0;

  return (
    <div style={{ padding: "20px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>Atrasos e alertas</h2>
        <button onClick={() => window.print()} style={btnGhost}><Printer size={15} /> Imprimir</button>
      </div>

      {vazio ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-3)", fontSize: 14 }}>
          Nenhum pedido em alerta. Tudo dentro do prazo.
        </div>
      ) : grupos.map((g) => {
        if (g.itens.length === 0) return null;
        const Icone = g.icone;
        return (
          <div key={g.titulo} style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Icone size={16} style={{ color: g.cor }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: g.cor }}>{g.titulo}</span>
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>({g.itens.length})</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {g.itens.map(({ pe, dias, emProducao, onde }) => (
                <div key={pe.id} style={{ ...cartao, borderLeft: `3px solid ${g.cor}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{pe.referencia}</span>
                      {pe.marca && <span style={{ fontSize: 12, color: "var(--text-2)", marginLeft: 8 }}>{pe.marca}</span>}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: g.cor }}>{textoDias(dias)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-2)", margin: "3px 0 8px" }}>{nomeCliente(pe.cliente_id)}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-3)" }}>
                    <span>Prazo: {formatarData(pe.prazo)}</span>
                    <span>{emProducao} peças em produção</span>
                  </div>
                  {onde && <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>{onde}</div>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const btnGhost = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", fontSize: 13, fontWeight: 600, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer" };
const cartao = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" };
