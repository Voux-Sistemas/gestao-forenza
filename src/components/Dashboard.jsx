import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient.js";
import { ArrowRight, LayoutGrid, AlertTriangle, Inbox, Package, CheckCircle2 } from "lucide-react";

const ETAPAS = [
  { nome: "Entrada", cor: "var(--text-3)" },
  { nome: "Corte", cor: "var(--accent)" },
  { nome: "Oficina", cor: "var(--warning)" },
  { nome: "Acabamento", cor: "var(--orange)" },
];

function calcularSaldos(pedidoId, total, movimentos) {
  const s = { Entrada: total, Corte: 0, Oficina: 0, Acabamento: 0, Estoque: 0, Perda: 0, Primeira: 0, Segunda: 0 };
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
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export default function Dashboard({ perfil, onNavegar }) {
  const [pedidos, setPedidos] = useState([]);
  const [movimentos, setMovimentos] = useState([]);
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    const [p, m, s] = await Promise.all([
      supabase.from("pedidos").select("*"),
      supabase.from("movimentos").select("*"),
      supabase.from("solicitacoes").select("status"),
    ]);
    setPedidos(p.data || []); setMovimentos(m.data || []); setSolicitacoes(s.data || []);
    setCarregando(false);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    const canal = supabase.channel("dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "movimentos" }, carregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, carregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "solicitacoes" }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [carregar]);

  if (carregando) return <div className="fade-in" style={{ padding: 28, color: "var(--text-2)" }}>Carregando seu painel…</div>;

  // ── Produção ──
  const etapaTotais = { Entrada: 0, Corte: 0, Oficina: 0, Acabamento: 0 };
  let pcProducao = 0, pedAtivos = 0, pcEstoque = 0, prim = 0, seg = 0;
  let atrasados = 0, criticos = 0, atencao = 0;

  pedidos.forEach((pe) => {
    const s = calcularSaldos(pe.id, pe.total, movimentos);
    const emProd = s.Entrada + s.Corte + s.Oficina + s.Acabamento;
    etapaTotais.Entrada += s.Entrada; etapaTotais.Corte += s.Corte;
    etapaTotais.Oficina += s.Oficina; etapaTotais.Acabamento += s.Acabamento;
    pcProducao += emProd; pcEstoque += s.Estoque; prim += s.Primeira; seg += s.Segunda;
    if (emProd > 0) {
      pedAtivos++;
      const d = diasAtePrazo(pe.prazo);
      if (d !== null && d <= 2) {
        if (d < 0) atrasados++;
        else if (d <= 1) criticos++;
        else atencao++;
      }
    }
  });
  const totalAlerta = atrasados + criticos + atencao;

  // ── Pilotagem ──
  const cont = (st) => solicitacoes.filter((s) => s.status === st).length;
  const paraAnalisar = cont("em_triagem");
  const emPilotagem = cont("em_pilotagem");
  const aguardandoCliente = cont("info_solicitada");

  // ── Foco do dia ──
  let foco;
  if (atrasados > 0) foco = { txt: `${atrasados} pedido(s) atrasado(s) precisam de atenção agora.`, cor: "var(--danger)", bg: "var(--danger-bg)" };
  else if (criticos > 0) foco = { txt: `${criticos} pedido(s) vencem hoje ou amanhã — fique de olho.`, cor: "var(--orange)", bg: "var(--orange-bg)" };
  else if (paraAnalisar > 0) foco = { txt: `${paraAnalisar} solicitação(ões) aguardando sua análise na pilotagem.`, cor: "var(--accent)", bg: "var(--accent-bg)" };
  else if (pcEstoque > 0) foco = { txt: `${pcEstoque} peça(s) aguardando inspeção no estoque.`, cor: "var(--warning)", bg: "var(--warning-bg)" };
  else foco = { txt: "Tudo sob controle por aqui. Bom trabalho!", cor: "var(--success)", bg: "var(--success-bg)" };

  const primeiroNome = (perfil?.nome || "").trim().split(/\s+/)[0] || "";
  const dataLonga = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  return (
    <div className="fade-in" style={{ padding: "24px 22px", maxWidth: 980, margin: "0 auto" }}>
      <div style={{ marginBottom: 6, fontSize: 12.5, color: "var(--text-3)", textTransform: "capitalize" }}>{dataLonga}</div>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}>
        {saudacao()}{primeiroNome ? `, ${primeiroNome}` : ""}.
      </h1>

      <div style={{ display: "inline-flex", alignItems: "center", gap: 9, marginTop: 14, marginBottom: 26, padding: "9px 14px", borderRadius: 11, background: foco.bg, border: `1px solid ${foco.cor}22` }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: foco.cor, flexShrink: 0 }} />
        <span style={{ fontSize: 13.5, fontWeight: 600, color: foco.cor }}>{foco.txt}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 14 }}>

        {/* Produção */}
        <Widget titulo="Produção" Icon={LayoutGrid} cor="var(--accent)" cta="Abrir quadro" onClick={() => onNavegar("quadro")}>
          <Numero valor={pcProducao} sub={`${pcProducao === 1 ? "peça" : "peças"} em ${pedAtivos} ${pedAtivos === 1 ? "pedido ativo" : "pedidos ativos"}`} />
          <div style={{ marginTop: 4 }}>
            <div style={{ display: "flex", height: 8, borderRadius: 99, overflow: "hidden", background: "var(--surface-3)" }}>
              {ETAPAS.map((e) => {
                const v = etapaTotais[e.nome];
                return v > 0 ? <div key={e.nome} style={{ width: `${(v / pcProducao) * 100}%`, background: e.cor }} title={`${e.nome}: ${v}`} /> : null;
              })}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 14px", marginTop: 10 }}>
              {ETAPAS.map((e) => (
                <span key={e.nome} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-2)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: e.cor }} />
                  {e.nome} <strong style={{ color: "var(--text)", fontWeight: 700 }}>{etapaTotais[e.nome]}</strong>
                </span>
              ))}
            </div>
          </div>
        </Widget>

        {/* Alertas */}
        <Widget titulo="Alertas de prazo" Icon={AlertTriangle} cor={atrasados > 0 ? "var(--danger)" : totalAlerta > 0 ? "var(--warning)" : "var(--success)"} cta="Ver alertas" onClick={() => onNavegar("atrasos")}>
          {totalAlerta === 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
              <CheckCircle2 size={26} style={{ color: "var(--success)" }} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Tudo no prazo</div>
                <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>nenhum pedido em alerta</div>
              </div>
            </div>
          ) : (
            <>
              <Numero valor={totalAlerta} sub={`${totalAlerta === 1 ? "pedido precisa" : "pedidos precisam"} de atenção`} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 4 }}>
                <Pilula n={atrasados} rotulo="atrasados" cor="var(--danger)" bg="var(--danger-bg)" />
                <Pilula n={criticos} rotulo="hoje/amanhã" cor="var(--orange)" bg="var(--orange-bg)" />
                <Pilula n={atencao} rotulo="em 2 dias" cor="var(--warning)" bg="var(--warning-bg)" />
              </div>
            </>
          )}
        </Widget>

        {/* Pilotagem */}
        <Widget titulo="Pilotagem" Icon={Inbox} cor="var(--accent)" cta="Ir para pilotagem" onClick={() => onNavegar("triagem")}>
          <Numero valor={paraAnalisar} sub={`${paraAnalisar === 1 ? "solicitação" : "solicitações"} para analisar`} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 4 }}>
            <Pilula n={emPilotagem} rotulo="em pilotagem" cor="var(--accent)" bg="var(--accent-bg)" />
            <Pilula n={aguardandoCliente} rotulo="aguardando cliente" cor="var(--text-2)" bg="var(--surface-2)" />
          </div>
        </Widget>

        {/* Estoque */}
        <Widget titulo="Estoque" Icon={Package} cor="var(--warning)" cta="Abrir estoque" onClick={() => onNavegar("estoque")}>
          <Numero valor={pcEstoque} sub={`${pcEstoque === 1 ? "peça aguardando" : "peças aguardando"} inspeção`} valorCor="var(--warning)" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 4 }}>
            <Pilula n={prim} rotulo="1ª qualidade" cor="var(--success)" bg="var(--success-bg)" />
            <Pilula n={seg} rotulo="2ª qualidade" cor="var(--orange)" bg="var(--orange-bg)" />
          </div>
        </Widget>

      </div>
    </div>
  );
}

function Widget({ titulo, Icon, cor, cta, onClick, children }) {
  return (
    <button className="lift" onClick={onClick} style={{
      textAlign: "left", width: "100%", cursor: "pointer", display: "flex", flexDirection: "column", gap: 14,
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px 16px", boxShadow: "var(--shadow-sm)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 7, height: 7, borderRadius: 99, background: cor, flexShrink: 0 }} />
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--text-2)" }}>{titulo}</span>
        <Icon size={16} strokeWidth={2} style={{ marginLeft: "auto", color: "var(--text-3)" }} />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 700, color: "var(--accent)" }}>
        {cta} <ArrowRight size={14} />
      </div>
    </button>
  );
}

function Numero({ valor, sub, valorCor }) {
  return (
    <div>
      <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, letterSpacing: "-.02em", color: valorCor || "var(--text)" }}>{valor}</div>
      <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 7 }}>{sub}</div>
    </div>
  );
}

function Pilula({ n, rotulo, cor, bg }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: cor, background: bg, padding: "4px 10px", borderRadius: 99 }}>
      <strong style={{ fontWeight: 800 }}>{n}</strong> {rotulo}
    </span>
  );
}
