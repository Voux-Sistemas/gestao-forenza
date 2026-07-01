import React, { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "../supabaseClient.js";
import {
  ArrowRight, LayoutGrid, AlertTriangle, Package, MessageCircle, Boxes,
  Clock, ArrowUpRight, ArrowDownLeft, ClipboardCheck, MessageSquare,
  RefreshCw,
} from "lucide-react";

const ETAPAS = [
  { nome: "Entrada", cor: "var(--text-3)" },
  { nome: "Corte", cor: "var(--accent)" },
  { nome: "Oficina", cor: "var(--warning)" },
  { nome: "Acabamento", cor: "var(--orange)" },
];

function calcularSaldos(pedidoId, total, movimentos) {
  const s = { Entrada: total, Corte: 0, Oficina: 0, Acabamento: 0, Estoque: 0, Perda: 0, Primeira: 0, Segunda: 0, Saida: 0 };
  for (const m of movimentos) {
    if (m.pedido_id !== pedidoId) continue;
    if (s[m.de_local] === undefined) s[m.de_local] = 0;
    if (s[m.para_local] === undefined) s[m.para_local] = 0;
    s[m.de_local] -= m.qtd;
    s[m.para_local] += m.qtd;
  }
  return s;
}

function diasAtePrazo(prazo) {
  if (!prazo) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const p = prazo.split("-").map(Number);
  const dt = new Date(p[0], p[1] - 1, p[2]); dt.setHours(0, 0, 0, 0);
  return Math.round((dt - hoje) / 86400000);
}

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function fmtDataExtenso() {
  const d = new Date();
  const dias = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]}`;
}

function tempoRelativo(dataStr) {
  if (!dataStr) return "";
  const dt = new Date(dataStr);
  const agora = new Date();
  const min = Math.round((agora - dt) / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `há ${hrs} ${hrs === 1 ? "hora" : "horas"}`;
  const dias = Math.round(hrs / 24);
  return `há ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

export default function Dashboard({ perfil, onNavegar }) {
  const [pedidos, setPedidos] = useState([]);
  const [movimentos, setMovimentos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [oficinas, setOficinas] = useState([]);
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [comentarios, setComentarios] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    const [p, m, c, o, s, cm] = await Promise.all([
      supabase.from("pedidos").select("*"),
      supabase.from("movimentos").select("*").order("id", { ascending: false }).limit(500),
      supabase.from("clientes").select("id, nome"),
      supabase.from("oficinas").select("id, nome_empresa"),
      supabase.from("solicitacoes").select("id, cliente_id, descricao, status, criado_em").order("id", { ascending: false }).limit(20),
      supabase.from("comentarios_pilotagem").select("id, solicitacao_id, autor, texto, criado_em").order("id", { ascending: false }).limit(20),
    ]);
    setPedidos(p.data || []);
    setMovimentos(m.data || []);
    setClientes(c.data || []);
    setOficinas(o.data || []);
    setSolicitacoes(s.data || []);
    setComentarios(cm.data || []);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const nomeCliente = (id) => clientes.find((c) => c.id === id)?.nome || "—";
  const nomeOficina = (id) => oficinas.find((o) => o.id === id)?.nome_empresa || "—";
  const pedidoInfo = (id) => pedidos.find((p) => p.id === id);

  const stats = useMemo(() => {
    let entrada = 0, corte = 0, oficina = 0, acabamento = 0, estoque = 0, prim = 0, ativos = 0;
    let atrasados = 0, hojeAmanha = 0, em2dias = 0;
    let pedidoAtrasadoDestaque = null;

    pedidos.forEach((pe) => {
      const s = calcularSaldos(pe.id, pe.total, movimentos);
      entrada += s.Entrada; corte += s.Corte; oficina += s.Oficina;
      acabamento += s.Acabamento; estoque += s.Estoque; prim += s.Primeira;
      const producao = s.Entrada + s.Corte + s.Oficina + s.Acabamento;
      if (producao > 0) {
        ativos++;
        const d = diasAtePrazo(pe.prazo);
        if (d !== null) {
          if (d < 0) {
            atrasados++;
            if (!pedidoAtrasadoDestaque || d < pedidoAtrasadoDestaque.dias) {
              pedidoAtrasadoDestaque = { pe, dias: d };
            }
          } else if (d <= 1) hojeAmanha++;
          else if (d <= 2) em2dias++;
        }
      }
    });

    const pilotagemPendente = solicitacoes.filter((s) => s.status === "em_triagem" || s.status === "info_solicitada").length;
    const emPilotagem = solicitacoes.filter((s) => s.status === "em_pilotagem").length;
    const totalProd = entrada + corte + oficina + acabamento;

    return {
      entrada, corte, oficina, acabamento, estoque, prim, ativos, totalProd,
      atrasados, hojeAmanha, em2dias, pedidoAtrasadoDestaque,
      pilotagemPendente, emPilotagem,
    };
  }, [pedidos, movimentos, solicitacoes]);

  const producao7dias = useMemo(() => {
    const dias = [];
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(hoje); d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      dias.push({
        data: d, iso,
        letra: ["D", "S", "T", "Q", "Q", "S", "S"][d.getDay()],
        qtd: 0,
      });
    }
    movimentos.forEach((m) => {
      const md = (m.data || m.criado_em || "").slice(0, 10);
      const dia = dias.find((x) => x.iso === md);
      if (dia && (m.para_local === "Estoque" || m.para_local === "Primeira" || m.para_local === "Segunda")) {
        dia.qtd += m.qtd;
      }
    });
    const maxQtd = Math.max(...dias.map((d) => d.qtd), 1);
    const total = dias.reduce((s, d) => s + d.qtd, 0);
    const totalHoje = dias[dias.length - 1].qtd;
    return { dias, maxQtd, total, totalHoje };
  }, [movimentos]);

  const atividadeRecente = useMemo(() => {
    const items = [];
    movimentos.slice(0, 30).forEach((m) => {
      const pe = pedidoInfo(m.pedido_id);
      if (!pe) return;
      const t = m.data || m.criado_em;
      if (m.de_local === "Oficina" && m.para_local !== "Oficina") {
        items.push({
          tipo: "retorno_oficina", id: `m${m.id}`, quando: t,
          texto: (
            <><strong>{m.qtd} peças</strong> voltaram da oficina para <strong>{m.para_local}</strong></>
          ),
          sub: `${pe.referencia} · ${nomeCliente(pe.cliente_id)}`,
          Icone: ArrowDownLeft, bg: "var(--success-bg)", cor: "var(--success)",
        });
      } else if (m.para_local === "Oficina") {
        items.push({
          tipo: "saida_oficina", id: `m${m.id}`, quando: t,
          texto: <><strong>{m.qtd} peças</strong> saíram do {m.de_local} para <strong>oficina</strong></>,
          sub: `${pe.referencia} · ${nomeCliente(pe.cliente_id)}`,
          Icone: ArrowUpRight, bg: "var(--accent-bg)", cor: "var(--accent)",
        });
      } else if (m.para_local === "Estoque") {
        items.push({
          tipo: "estoque", id: `m${m.id}`, quando: t,
          texto: <><strong>{m.qtd} peças</strong> chegaram no <strong>estoque</strong></>,
          sub: `${pe.referencia} · ${nomeCliente(pe.cliente_id)}`,
          Icone: Boxes, bg: "var(--warning-bg)", cor: "var(--warning)",
        });
      } else if (m.para_local === "Primeira" || m.para_local === "Segunda") {
        const q = m.para_local === "Primeira" ? "1ª qualidade" : "2ª qualidade";
        items.push({
          tipo: "inspecao", id: `m${m.id}`, quando: t,
          texto: <><strong>{m.qtd} peças</strong> aprovadas em <strong>{q}</strong></>,
          sub: `${pe.referencia} · ${nomeCliente(pe.cliente_id)}`,
          Icone: ClipboardCheck, bg: "var(--success-bg)", cor: "var(--success)",
        });
      }
    });
    comentarios.slice(0, 10).forEach((c) => {
      const sol = solicitacoes.find((s) => s.id === c.solicitacao_id);
      if (!sol) return;
      if (c.autor === "cliente") {
        items.push({
          tipo: "cliente_respondeu", id: `c${c.id}`, quando: c.criado_em,
          texto: <><strong>Cliente respondeu</strong> na pilotagem</>,
          sub: `${nomeCliente(sol.cliente_id)} · ${(sol.descricao || "").slice(0, 40)}${(sol.descricao || "").length > 40 ? "…" : ""}`,
          Icone: MessageSquare, bg: "var(--accent-bg)", cor: "var(--accent)",
        });
      }
    });
    items.sort((a, b) => new Date(b.quando) - new Date(a.quando));
    return items.slice(0, 5);
  }, [movimentos, comentarios, solicitacoes, pedidos, clientes]);

  const primeiroNome = (perfil?.nome || "").trim().split(/\s+/)[0] || "";

  if (carregando) {
    return <div style={{ padding: 28, color: "var(--text-2)" }}>Carregando…</div>;
  }

  const cards = [
    { titulo: "EM PRODUÇÃO", valor: stats.totalProd.toLocaleString("pt-BR"), sub: `${stats.ativos} pedido(s) ativo(s)`, Icon: Package, cor: "var(--accent)", bg: "var(--accent-bg)", onClick: () => onNavegar?.("quadro") },
    { titulo: "PRAZO", valor: stats.atrasados, sub: `atrasado(s) · ${stats.hojeAmanha} hoje/amanhã`, Icon: Clock, cor: stats.atrasados > 0 ? "var(--danger)" : "var(--warning)", bg: stats.atrasados > 0 ? "var(--danger-bg)" : "var(--warning-bg)", onClick: () => onNavegar?.("atrasos") },
    { titulo: "ESTOQUE", valor: (stats.estoque + stats.prim).toLocaleString("pt-BR"), sub: `${stats.prim} aprovadas · ${stats.estoque} espera`, Icon: Boxes, cor: "var(--success)", bg: "var(--success-bg)", onClick: () => onNavegar?.("estoque") },
    { titulo: "PILOTAGEM", valor: stats.pilotagemPendente, sub: stats.pilotagemPendente === 0 ? "nenhuma pendente" : `pendente(s) · ${stats.emPilotagem} em análise`, Icon: MessageCircle, cor: "var(--text-2)", bg: "var(--surface-2)", onClick: () => onNavegar?.("triagem") },
  ];

  return (
    <div className="fade-in" style={{ padding: "20px 24px", maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 500 }}>{fmtDataExtenso()}</div>
          <div style={{ fontSize: 24, fontWeight: 500, color: "var(--text)", marginTop: 4 }}>
            {saudacao()}{primeiroNome && `, ${primeiroNome}`}.
          </div>
        </div>
        <button onClick={carregar} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", fontSize: 13, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer" }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {stats.pedidoAtrasadoDestaque && (
        <button
          onClick={() => onNavegar?.("atrasos")}
          style={{ width: "100%", textAlign: "left", padding: "14px 16px", background: "var(--danger-bg)", borderLeft: "3px solid var(--danger)", borderRadius: "0 8px 8px 0", border: "none", borderLeftWidth: 3, borderLeftStyle: "solid", borderLeftColor: "var(--danger)", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", marginBottom: 20 }}
        >
          <AlertTriangle size={20} style={{ color: "var(--danger)", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--danger)" }}>
              {stats.atrasados} pedido{stats.atrasados > 1 ? "s" : ""} atrasado{stats.atrasados > 1 ? "s" : ""} precisa{stats.atrasados > 1 ? "m" : ""} da sua atenção
            </div>
            <div style={{ fontSize: 12, color: "var(--danger)", opacity: 0.85, marginTop: 2 }}>
              {stats.pedidoAtrasadoDestaque.pe.referencia} · {nomeCliente(stats.pedidoAtrasadoDestaque.pe.cliente_id)} · vencido há {Math.abs(stats.pedidoAtrasadoDestaque.dias)} dia(s)
            </div>
          </div>
          <ArrowRight size={18} style={{ color: "var(--danger)" }} />
        </button>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 20 }}>
        {cards.map((c) => (
          <button
            key={c.titulo}
            onClick={c.onClick}
            style={{ textAlign: "left", padding: 16, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, cursor: c.onClick ? "pointer" : "default", boxShadow: "var(--shadow-card)", transition: "transform .12s, box-shadow .15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "var(--shadow-md)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "var(--shadow-card)"; }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <c.Icon size={18} style={{ color: c.cor }} />
              </div>
              <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600, letterSpacing: 0.5 }}>{c.titulo}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>{c.valor}</div>
            <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 6 }}>{c.sub}</div>
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14, marginBottom: 16 }}>
        <div style={{ padding: "18px 20px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "var(--shadow-card)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Fluxo de produção</div>
              <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Distribuição das peças pelas etapas</div>
            </div>
          </div>
          {stats.totalProd === 0 ? (
            <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>Nenhuma peça em produção no momento.</div>
          ) : (
            <>
              <div style={{ display: "flex", height: 10, borderRadius: 99, overflow: "hidden", marginBottom: 14, background: "var(--surface-2)" }}>
                {ETAPAS.map((et) => {
                  const v = stats[et.nome.toLowerCase()];
                  const pct = (v / stats.totalProd) * 100;
                  return pct > 0 ? <div key={et.nome} style={{ width: `${pct}%`, background: et.cor }} title={`${et.nome} ${v}`} /> : null;
                })}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {ETAPAS.map((et) => (
                  <div key={et.nome}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: et.cor }} />
                      <span style={{ fontSize: 11, color: "var(--text-3)" }}>{et.nome}</span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{stats[et.nome.toLowerCase()].toLocaleString("pt-BR")}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 12, color: "var(--text-2)" }}>Total: {stats.totalProd.toLocaleString("pt-BR")} peças · {stats.ativos} pedidos ativos</div>
            <button onClick={() => onNavegar?.("quadro")} style={{ fontSize: 12, color: "var(--accent)", background: "transparent", border: "none", cursor: "pointer", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
              Abrir quadro <ArrowRight size={12} />
            </button>
          </div>
        </div>

        <div style={{ padding: "18px 20px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "var(--shadow-card)" }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Peças finalizadas</div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Últimos 7 dias</div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", height: 90, gap: 6, marginBottom: 8 }}>
            {producao7dias.dias.map((d, i) => {
              const alt = d.qtd > 0 ? Math.max((d.qtd / producao7dias.maxQtd) * 100, 8) : 4;
              const ehHoje = i === producao7dias.dias.length - 1;
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1 }}>
                  <div title={`${d.qtd} peças`} style={{ width: "100%", height: `${alt}%`, background: ehHoje ? "var(--accent)" : "var(--accent-bg)", borderRadius: "4px 4px 0 0" }} />
                  <span style={{ fontSize: 10, color: "var(--text-3)" }}>{d.letra}</span>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: 10, borderTop: "1px solid var(--border)" }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{producao7dias.total.toLocaleString("pt-BR")}</div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>peças concluídas</div>
            </div>
            {producao7dias.totalHoje > 0 && (
              <span style={{ fontSize: 12, color: "var(--success)", fontWeight: 600 }}>+{producao7dias.totalHoje} hoje</span>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: "18px 20px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "var(--shadow-card)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Atividade recente</div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Últimas movimentações no sistema</div>
          </div>
        </div>

        {atividadeRecente.length === 0 ? (
          <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>Nenhuma atividade recente.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {atividadeRecente.map((a, i) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: i < atividadeRecente.length - 1 ? 10 : 0, borderBottom: i < atividadeRecente.length - 1 ? "1px solid var(--border)" : "none" }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: a.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <a.Icone size={14} style={{ color: a.cor }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--text)" }}>{a.texto}</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{a.sub} · {tempoRelativo(a.quando)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
