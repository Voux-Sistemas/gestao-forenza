import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Download, Search, Check, X, Filter, Calendar } from "lucide-react";
import { supabase } from "../supabaseClient.js";
import { PRODUCAO, rotuloLocal, calcularSaldos } from "../etapas.js";
import { gerarPainelEtapa } from "../pdfPainel.js";
import { CalendarioRange } from "./CalendarioRange.jsx";

// Painel "Tabela" — visão da direção. Uma etapa por vez, com filtros e edição inline
// da nova data de entrega (prorrogação) e da observação da diretora.

const CORES_ETAPA_HEX = {
  "Ficha Técnica de Corte": "var(--teal)",
  "Corte": "var(--azul)",
  "Amostra": "var(--rosa)",
  "Oficina": "var(--warning)",
  "Aviação": "var(--roxo)",
  "Acabamento": "var(--orange)",
};

const hoje = () => new Date().toISOString().slice(0, 10);
const fmt = (d) => {
  if (!d) return "—";
  const dt = /^\d{4}-\d{2}-\d{2}/.test(d) ? new Date(d.slice(0, 10) + "T12:00") : new Date(d);
  return isNaN(dt) ? "—" : dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
};
const soData = (d) => (d ? String(d).slice(0, 10) : "");

export default function Tabela() {
  const [pedidos, setPedidos] = useState([]);
  const [movimentos, setMovimentos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [oficinas, setOficinas] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const [etapa, setEtapa] = useState("__tudo__");   // "__tudo__" = todas as etapas
  const [fMarca, setFMarca] = useState("");        // filtro por marca/cliente
  const [perEtapa, setPerEtapa] = useState("tudo"); // preset do "na etapa"
  const [popEtapa, setPopEtapa] = useState(false);
  const [perEntrega, setPerEntrega] = useState("tudo");
  const [popEntrega, setPopEntrega] = useState(false);
  const [fEtapaDe, setFEtapaDe] = useState("");     // entrou na etapa a partir de
  const [fEtapaAte, setFEtapaAte] = useState("");   // entrou na etapa até
  const [fEntregaDe, setFEntregaDe] = useState(""); // entrega a partir de
  const [fEntregaAte, setFEntregaAte] = useState(""); // entrega até

  const [edit, setEdit] = useState(null);   // { id, campo } célula em edição
  const [rascunho, setRascunho] = useState("");
  const [salvandoId, setSalvandoId] = useState(null);

  const carregar = useCallback(async () => {
    const [pe, cl, of] = await Promise.all([
      supabase.from("pedidos").select("*").eq("arquivado", false).order("id"),
      supabase.from("clientes").select("*").order("nome"),
      supabase.from("oficinas").select("*").order("nome_empresa"),
    ]);
    const ped = pe.data || [];
    setPedidos(ped);
    setClientes(cl.data || []);
    setOficinas(of.data || []);
    const ids = ped.map((p) => p.id);
    if (ids.length) {
      const mv = await supabase.from("movimentos").select("*").in("pedido_id", ids).order("id");
      setMovimentos(mv.data || []);
    }
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const nomeCliente = useCallback((id) => clientes.find((c) => c.id === id)?.nome || "—", [clientes]);
  const nomeOficina = useCallback((id) => oficinas.find((o) => o.id === id)?.nome_empresa || "", [oficinas]);

  const tudo = etapa === "__tudo__";

  // Traduz os presets de período em intervalos de data efetivos.
  const rangeEtapa = useMemo(() => {
    const d = (off) => { const x = new Date(); x.setDate(x.getDate() + off); return x.toISOString().slice(0, 10); };
    if (perEtapa === "hoje") return { de: d(0), ate: d(0) };
    if (perEtapa === "ontem") return { de: d(-1), ate: d(-1) };
    if (perEtapa === "7") return { de: d(-7), ate: d(0) };
    if (perEtapa === "custom") return { de: fEtapaDe, ate: fEtapaAte };
    return { de: "", ate: "" };
  }, [perEtapa, fEtapaDe, fEtapaAte]);

  const rangeEntrega = useMemo(() => {
    const d = (off) => { const x = new Date(); x.setDate(x.getDate() + off); return x.toISOString().slice(0, 10); };
    if (perEntrega === "atrasadas") return { de: "", ate: d(-1) };   // vence antes de hoje
    if (perEntrega === "7") return { de: d(0), ate: d(7) };
    if (perEntrega === "30") return { de: d(0), ate: d(30) };
    if (perEntrega === "custom") return { de: fEntregaDe, ate: fEntregaAte };
    return { de: "", ate: "" };
  }, [perEntrega, fEntregaDe, fEntregaAte]);

  // Momento em que o pedido entrou numa etapa = data da última movimentação para ela.
  const entradaNaEtapa = useCallback((pedidoId, et) => {
    const movs = movimentos.filter((m) => m.pedido_id === pedidoId && m.para_local === et);
    if (!movs.length) return null;
    const ultimo = movs.reduce((a, b) => (a.id > b.id ? a : b));
    return ultimo.data || ultimo.criado_em || null;
  }, [movimentos]);

  // Linhas: pedidos com saldo > 0. Em "Tudo", uma linha por etapa onde há peças.
  const linhas = useMemo(() => {
    const out = [];
    for (const pe of pedidos) {
      const saldos = calcularSaldos(pe.id, pe.total, movimentos);
      const etapasAlvo = tudo ? PRODUCAO.filter((et) => (saldos[et] || 0) > 0) : [etapa];

      for (const et of etapasAlvo) {
        const naEtapa = saldos[et] || 0;
        if (naEtapa <= 0) continue;

        if (fMarca) {
          const alvo = `${pe.marca || ""} ${nomeCliente(pe.cliente_id)}`.toLowerCase();
          if (!alvo.includes(fMarca.toLowerCase())) continue;
        }
        const entrada = soData(entradaNaEtapa(pe.id, et));
        if (rangeEtapa.de && (!entrada || entrada < rangeEtapa.de)) continue;
        if (rangeEtapa.ate && (!entrada || entrada > rangeEtapa.ate)) continue;
        const entrega = soData(pe.nova_entrega || pe.prazo);
        if (rangeEntrega.de && (!entrega || entrega < rangeEntrega.de)) continue;
        if (rangeEntrega.ate && (!entrega || entrega > rangeEntrega.ate)) continue;

        const prazoBase = soData(pe.prazo);
        const atrasado = prazoBase && prazoBase < hoje() && !pe.nova_entrega;
        out.push({
          pe,
          etapaLinha: et,
          marca: pe.marca || nomeCliente(pe.cliente_id) || "—",
          naEtapa,
          entrada,
          atrasado,
        });
      }
    }
    out.sort((a, b) => a.marca.localeCompare(b.marca) || String(a.pe.referencia).localeCompare(String(b.pe.referencia)));
    return out;
  }, [pedidos, movimentos, etapa, tudo, fMarca, rangeEtapa, rangeEntrega, nomeCliente, entradaNaEtapa]);

  // Lista de marcas para o dropdown (distintas, ordenadas).
  const marcasDisponiveis = useMemo(() => {
    const set = new Set();
    for (const pe of pedidos) {
      const m = pe.marca || nomeCliente(pe.cliente_id);
      if (m && m !== "—") set.add(m);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [pedidos, nomeCliente]);

  // Agrupa: por ETAPA quando é "Tudo"; por MARCA quando é etapa única.
  const blocos = useMemo(() => {
    const map = new Map();
    const chaveDe = (l) => (tudo ? l.etapaLinha : l.marca);
    for (const l of linhas) {
      const k = chaveDe(l);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(l);
    }
    let entradas = [...map.entries()];
    if (tudo) {
      // ordena os blocos na ordem das etapas de produção
      entradas.sort((a, b) => PRODUCAO.indexOf(a[0]) - PRODUCAO.indexOf(b[0]));
    } else {
      entradas.sort((a, b) => a[0].localeCompare(b[0]));
    }
    return entradas.map(([chave, itens]) => ({
      chave,
      titulo: tudo ? rotuloLocal(chave) : chave,
      itens,
      pecas: itens.reduce((a, i) => a + i.naEtapa, 0),
    }));
  }, [linhas, tudo]);

  const totalPecas = linhas.reduce((a, l) => a + l.naEtapa, 0);
  const totalAtrasados = linhas.filter((l) => l.atrasado).length;

  const abrirEdicao = (id, campo, valorAtual) => {
    setEdit({ id, campo });
    setRascunho(campo === "nova_entrega" ? soData(valorAtual) : (valorAtual || ""));
  };
  const cancelarEdicao = () => { setEdit(null); setRascunho(""); };
  const salvarEdicao = async () => {
    if (!edit) return;
    const { id, campo } = edit;
    const valor = campo === "nova_entrega" ? (rascunho || null) : (rascunho.trim() || null);
    setSalvandoId(id);
    const { error } = await supabase.from("pedidos").update({ [campo]: valor }).eq("id", id);
    if (!error) {
      setPedidos((ps) => ps.map((p) => (p.id === id ? { ...p, [campo]: valor } : p)));
    }
    setSalvandoId(null);
    cancelarEdicao();
  };

  const baixarPdf = () => {
    const CORES = { "Ficha Técnica de Corte": [14, 138, 138], "Corte": [45, 108, 179], "Amostra": [196, 60, 122], "Oficina": [186, 117, 23], "Aviação": [107, 95, 196], "Acabamento": [217, 101, 12], "Entrada": [130, 128, 120] };
    gerarPainelEtapa({
      etapa, tudo,
      blocos: blocos.map((b) => ({
        chave: b.chave,
        titulo: b.titulo,
        cor: tudo ? (CORES[b.chave] || [29, 158, 117]) : (CORES[etapa] || [29, 158, 117]),
        itens: b.itens.map((i) => ({
          marca: i.marca,
          produto: i.pe.descricao || i.pe.produto || "—",
          referencia: i.pe.referencia,
          pedido: i.pe.pedido_num || i.pe.pedido || "—",
          qtd: i.naEtapa,
          corte: i.pe.total,
          ncorte: i.pe.corte_id || "—",
          oficina: nomeOficina(i.pe.oficina_id),
          entrega: i.pe.prazo,
          prorrog: i.pe.nova_entrega,
          oficial: i.pe.data_oficial,
          obs: i.pe.obs_diretora,
          atrasado: i.atrasado,
        })),
      })),
      filtros: { marca: fMarca, etapaDe: rangeEtapa.de, etapaAte: rangeEtapa.ate, entregaDe: rangeEntrega.de, entregaAte: rangeEntrega.ate },
      totais: { pedidos: linhas.length, pecas: totalPecas, atrasados: totalAtrasados },
    });
  };

  const limparFiltros = () => { setFMarca(""); setPerEtapa("tudo"); setPerEntrega("tudo"); setFEtapaDe(""); setFEtapaAte(""); setFEntregaDe(""); setFEntregaAte(""); };
  const temFiltro = fMarca || perEtapa !== "tudo" || perEntrega !== "tudo";

  return (
    <div style={{ padding: "22px 26px", maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Tabela</h1>
          <p style={{ fontSize: 13, color: "var(--text-2)", margin: "4px 0 0" }}>Painel da etapa — controle de pedidos, prazos e observações.</p>
        </div>
        <button onClick={baixarPdf} disabled={linhas.length === 0} style={{ ...btnPrimary, opacity: linhas.length ? 1 : 0.5, cursor: linhas.length ? "pointer" : "not-allowed" }}>
          <Download size={15} /> Baixar PDF
        </button>
      </div>

      {/* Seletor de etapa */}
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
        {[["__tudo__", "Tudo"], ...PRODUCAO.map((et) => [et, rotuloLocal(et)])].map(([id, label]) => {
          const ativo = id === etapa;
          const ehTudo = id === "__tudo__";
          return (
            <button key={id} onClick={() => setEtapa(id)}
              style={{ padding: "7px 14px", borderRadius: 9, border: `1px solid ${ativo ? "var(--accent)" : "var(--border)"}`, background: ativo ? "var(--accent-bg)" : "var(--surface)", color: ativo ? "var(--accent)" : "var(--text-2)", fontWeight: ativo || ehTudo ? 700 : 500, fontSize: 13, cursor: "pointer" }}>
              {label}
            </button>
          );
        })}
      </div>

      {/* Filtros — dropdowns como no Quadro (marca) e no Controle de Oficinas (período) */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 12.5, color: "var(--text-3)", display: "inline-flex", alignItems: "center", gap: 5 }}><Filter size={13} /> Filtrar:</span>

        {/* Marca — select simples (igual "Todos os clientes" do Quadro) */}
        <select value={fMarca} onChange={(e) => setFMarca(e.target.value)} style={selectPill}>
          <option value="">Todas as marcas</option>
          {marcasDisponiveis.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>

        {/* Na etapa — dropdown de período + calendário no Personalizado */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>Na etapa</span>
          <div style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <select value={perEtapa} onChange={(e) => { const v = e.target.value; setPerEtapa(v); setPopEtapa(v === "custom"); if (v !== "custom") { setFEtapaDe(""); setFEtapaAte(""); } }} style={selectPill}>
              <option value="tudo">Qualquer data</option>
              <option value="hoje">Hoje</option>
              <option value="ontem">Ontem</option>
              <option value="7">Últimos 7 dias</option>
              <option value="custom">Personalizado</option>
            </select>
            {perEtapa === "custom" && !popEtapa && (
              <button onClick={() => setPopEtapa(true)} style={{ ...selectPill, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Calendar size={13} style={{ color: "var(--accent)" }} />
                {fEtapaDe || fEtapaAte ? `${fEtapaDe ? fmt(fEtapaDe) : "início"} – ${fEtapaAte ? fmt(fEtapaAte) : "hoje"}` : "definir datas"}
              </button>
            )}
            {perEtapa === "custom" && popEtapa && (
              <>
                <div onClick={() => setPopEtapa(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                <div style={{ position: "absolute", top: 42, left: 0, zIndex: 41, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "var(--shadow-card)", padding: 14, width: 268 }}>
                  <CalendarioRange de={fEtapaDe} ate={fEtapaAte} onChange={(d, a) => { setFEtapaDe(d); setFEtapaAte(a); }} />
                  <div style={{ fontSize: 11.5, color: "var(--text-2)", textAlign: "center", margin: "10px 0 8px" }}>
                    {fEtapaDe ? fmt(fEtapaDe) : "início"} — {fEtapaAte ? fmt(fEtapaAte) : (fEtapaDe ? "selecione o fim" : "hoje")}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { setFEtapaDe(""); setFEtapaAte(""); }} style={{ ...btnGhost, flex: 1, padding: "7px 10px" }}>Limpar</button>
                    <button onClick={() => setPopEtapa(false)} style={{ ...btnPrimary, flex: 1, padding: "7px 10px" }}>Aplicar</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Entrega — mesmo dropdown de período + calendário */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>Entrega</span>
          <div style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <select value={perEntrega} onChange={(e) => { const v = e.target.value; setPerEntrega(v); setPopEntrega(v === "custom"); if (v !== "custom") { setFEntregaDe(""); setFEntregaAte(""); } }} style={selectPill}>
              <option value="tudo">Qualquer data</option>
              <option value="atrasadas">Vencidas</option>
              <option value="7">Próximos 7 dias</option>
              <option value="30">Próximos 30 dias</option>
              <option value="custom">Personalizado</option>
            </select>
            {perEntrega === "custom" && !popEntrega && (
              <button onClick={() => setPopEntrega(true)} style={{ ...selectPill, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Calendar size={13} style={{ color: "var(--accent)" }} />
                {fEntregaDe || fEntregaAte ? `${fEntregaDe ? fmt(fEntregaDe) : "início"} – ${fEntregaAte ? fmt(fEntregaAte) : "fim"}` : "definir datas"}
              </button>
            )}
            {perEntrega === "custom" && popEntrega && (
              <>
                <div onClick={() => setPopEntrega(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                <div style={{ position: "absolute", top: 42, left: 0, zIndex: 41, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "var(--shadow-card)", padding: 14, width: 268 }}>
                  <CalendarioRange de={fEntregaDe} ate={fEntregaAte} onChange={(d, a) => { setFEntregaDe(d); setFEntregaAte(a); }} />
                  <div style={{ fontSize: 11.5, color: "var(--text-2)", textAlign: "center", margin: "10px 0 8px" }}>
                    {fEntregaDe ? fmt(fEntregaDe) : "início"} — {fEntregaAte ? fmt(fEntregaAte) : (fEntregaDe ? "selecione o fim" : "fim")}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { setFEntregaDe(""); setFEntregaAte(""); }} style={{ ...btnGhost, flex: 1, padding: "7px 10px" }}>Limpar</button>
                    <button onClick={() => setPopEntrega(false)} style={{ ...btnPrimary, flex: 1, padding: "7px 10px" }}>Aplicar</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {temFiltro && (
          <button onClick={limparFiltros} style={{ ...selectPill, border: "none", color: "var(--text-3)", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <X size={12} /> Limpar
          </button>
        )}
      </div>

      {/* Totais */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <Kpi rot="PEDIDOS" val={linhas.length} />
        <Kpi rot="PEÇAS NA ETAPA" val={totalPecas.toLocaleString("pt-BR")} />
        <Kpi rot="ATRASADOS" val={totalAtrasados} destaque={totalAtrasados > 0} />
      </div>

      {/* Tabela */}
      {carregando ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-2)" }}>Carregando…</div>
      ) : linhas.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "var(--text-2)", border: "1px dashed var(--border)", borderRadius: 12 }}>
          Nenhum pedido em <b>{tudo ? "produção" : rotuloLocal(etapa)}</b>{temFiltro ? " com esses filtros" : ""}.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {blocos.map((b) => (
            <div key={b.chave} style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
              {/* cabeçalho do bloco */}
              <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 16px", background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                <span style={{ width: 11, height: 11, borderRadius: 3, background: tudo ? (CORES_ETAPA_HEX[b.chave] || "var(--accent)") : "var(--accent)" }} />
                <span style={{ fontWeight: 800, fontSize: 14 }}>{tudo ? rotuloLocal(b.chave) : b.chave}</span>
                <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>{b.itens.length} pedido(s) · {b.pecas.toLocaleString("pt-BR")} peças</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 1180 }}>
                  <thead>
                    <tr style={{ color: "var(--text-3)" }}>
                      {["Marca", "Produto", "Referência", "Pedido", "Qtd", "Corte", "Nº Corte", "Oficina", "Entrega", "Prorrog.", "Oficial", "Obs"].map((h) => (
                        <th key={h} style={{ ...th, textAlign: h === "Qtd" || h === "Corte" ? "right" : "left" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.itens.map(({ pe, marca, naEtapa, atrasado, etapaLinha }, li) => (
                      <tr key={pe.id + "-" + (etapaLinha || "") + "-" + li} style={{ borderTop: "1px solid var(--border)", background: atrasado ? "var(--danger-bg)" : (li % 2 ? "var(--surface-2)" : "transparent") }}>
                        <td style={{ ...td, fontWeight: 700 }}>{marca}</td>
                        <td style={td}>{pe.descricao || pe.produto || "—"}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{pe.referencia}</td>
                        <td style={{ ...td, color: "var(--text-2)" }}>{pe.pedido_num || pe.pedido || "—"}</td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{naEtapa}</td>
                        <td style={{ ...td, textAlign: "right", color: "var(--text-2)" }}>{pe.total}</td>
                        <td style={{ ...td, color: "var(--text-2)" }}>{pe.corte_id || "—"}</td>
                        <td style={{ ...td, color: "var(--text-2)" }}>{nomeOficina(pe.oficina_id) || "—"}</td>
                        <td style={{ ...td, whiteSpace: "nowrap" }}>
                          {pe.nova_entrega
                            ? <span style={{ textDecoration: "line-through", color: "var(--text-3)", fontSize: 11 }}>{fmt(pe.prazo)}</span>
                            : <span style={{ color: atrasado ? "var(--danger)" : "var(--success)", fontWeight: 600 }}>{fmt(pe.prazo)}</span>}
                        </td>
                        <CelulaData pe={pe} campo="nova_entrega" valor={pe.nova_entrega} corValor="var(--danger)" placeholder="+ prorrogar"
                          edit={edit} rascunho={rascunho} setRascunho={setRascunho} abrir={abrirEdicao} salvar={salvarEdicao} cancelar={cancelarEdicao} />
                        <CelulaData pe={pe} campo="data_oficial" valor={pe.data_oficial} corValor="var(--text)" placeholder="+ definir"
                          edit={edit} rascunho={rascunho} setRascunho={setRascunho} abrir={abrirEdicao} salvar={salvarEdicao} cancelar={cancelarEdicao} />
                        <td style={{ ...td, minWidth: 150 }}>
                          {edit?.id === pe.id && edit?.campo === "obs_diretora" ? (
                            <span style={{ display: "inline-flex", gap: 4, alignItems: "center", width: "100%" }}>
                              <input value={rascunho} onChange={(e) => setRascunho(e.target.value)} placeholder="Anotação…" style={{ ...inp, padding: "4px 8px", flex: 1 }} autoFocus
                                onKeyDown={(e) => { if (e.key === "Enter") salvarEdicao(); if (e.key === "Escape") cancelarEdicao(); }} />
                              <button onClick={salvarEdicao} style={iconOk}><Check size={13} /></button>
                              <button onClick={cancelarEdicao} style={iconNo}><X size={13} /></button>
                            </span>
                          ) : (
                            <span onClick={() => abrirEdicao(pe.id, "obs_diretora", pe.obs_diretora)} style={{ cursor: "pointer", color: pe.obs_diretora ? "var(--warning)" : "var(--text-3)", fontStyle: pe.obs_diretora ? "italic" : "normal" }} title="Clique para anotar">
                              {salvandoId === pe.id ? "salvando…" : (pe.obs_diretora || "+ anotar")}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Célula de data com edição inline (prorrogada / oficial).
function CelulaData({ pe, campo, valor, corValor, placeholder, edit, rascunho, setRascunho, abrir, salvar, cancelar }) {
  const editando = edit?.id === pe.id && edit?.campo === campo;
  const fmt = (d) => { if (!d) return ""; const dt = new Date(String(d).slice(0, 10) + "T12:00"); return isNaN(dt) ? "" : dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }); };
  return (
    <td style={{ ...td, whiteSpace: "nowrap" }}>
      {editando ? (
        <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
          <input type="date" value={rascunho} onChange={(e) => setRascunho(e.target.value)} style={{ padding: "4px 6px", fontSize: 12, borderRadius: 7, border: "1px solid var(--border)", width: 128 }} autoFocus />
          <button onClick={salvar} style={iconOk}><Check size={13} /></button>
          <button onClick={cancelar} style={iconNo}><X size={13} /></button>
        </span>
      ) : (
        <span onClick={() => abrir(pe.id, campo, valor)} style={{ cursor: "pointer", color: valor ? corValor : "var(--text-3)", fontWeight: valor ? 700 : 400 }} title="Clique para editar">
          {valor ? fmt(valor) : placeholder}
        </span>
      )}
    </td>
  );
}

function Kpi({ rot, val, destaque }) {
  return (
    <div style={{ border: `1px solid ${destaque ? "var(--danger)" : "var(--border)"}`, background: destaque ? "var(--danger-bg)" : "var(--surface)", borderRadius: 10, padding: "9px 15px", minWidth: 100 }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".05em", color: destaque ? "var(--danger)" : "var(--text-3)" }}>{rot}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color: destaque ? "var(--danger)" : "var(--text)", marginTop: 2 }}>{val}</div>
    </div>
  );
}

const selectPill = { padding: "6px 12px", fontSize: 12, borderRadius: 99, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer", boxSizing: "border-box" };


const lbl = { display: "block", fontSize: 10.5, fontWeight: 600, color: "var(--text-2)", marginBottom: 4 };
const inp = { padding: "8px 10px", fontSize: 13, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", boxSizing: "border-box" };
const th = { padding: "9px 12px", fontSize: 10.5, fontWeight: 700, letterSpacing: ".03em", textTransform: "uppercase" };
const td = { padding: "8px 12px", verticalAlign: "middle" };
const btnPrimary = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", fontSize: 13, fontWeight: 700, borderRadius: 9, border: "none", background: "linear-gradient(135deg,var(--accent),var(--accent-2))", color: "#fff", cursor: "pointer" };
const btnGhost = { display: "inline-flex", alignItems: "center", padding: "8px 13px", fontSize: 12.5, fontWeight: 600, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer" };
const iconOk = { width: 24, height: 24, borderRadius: 6, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" };
const iconNo = { width: 24, height: 24, borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" };
