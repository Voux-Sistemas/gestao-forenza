import React, { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "../supabaseClient.js";
import {
  Printer, AlertTriangle, AlertCircle, Clock, Calendar, HelpCircle, Flame,
  ExternalLink, Eye, ChevronDown, Filter, X,
} from "lucide-react";

const PRODUCAO = ["Entrada", "Corte", "Oficina", "Acabamento"];
const CORES_ETAPA = { Entrada: "var(--text-3)", Corte: "#185FA5", Oficina: "var(--warning)", Acabamento: "var(--orange)" };

function saldos(pedidoId, total, movimentos) {
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

function diasAte(prazo) {
  if (!prazo) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const [y, m, d] = prazo.split("-").map(Number);
  const alvo = new Date(y, m - 1, d);
  return Math.round((alvo - hoje) / 86400000);
}

function textoDias(dias) {
  if (dias === null) return "sem prazo";
  if (dias < 0) return `venceu há ${-dias} ${-dias === 1 ? "dia" : "dias"}`;
  if (dias === 0) return "vence hoje";
  if (dias === 1) return "vence amanhã";
  return `faltam ${dias} dias`;
}

function fmtDataBR(d) {
  if (!d) return "";
  const p = d.split("-");
  return `${p[2]}/${p[1]}/${p[0]}`;
}

// calcula há quanto tempo está no local atual (última entrada nesse local)
function diasParadoNoLocal(pedidoId, local, movimentos) {
  const entradasNoLocal = movimentos
    .filter((m) => m.pedido_id === pedidoId && m.para_local === local)
    .map((m) => (m.data || m.criado_em || "").slice(0, 10))
    .filter(Boolean)
    .sort();
  const dataUltimaEntrada = entradasNoLocal[entradasNoLocal.length - 1];
  if (!dataUltimaEntrada) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const [y, m, d] = dataUltimaEntrada.split("-").map(Number);
  const alvo = new Date(y, m - 1, d); alvo.setHours(0, 0, 0, 0);
  return Math.round((hoje - alvo) / 86400000);
}

function motivoTravado(pe, s, movimentos, oficinas) {
  const etapasAtivas = PRODUCAO.filter((et) => s[et] > 0);
  if (etapasAtivas.length === 0) return null;
  // pega a etapa com mais peças (a "principal" da hora)
  const principal = etapasAtivas.sort((a, b) => s[b] - s[a])[0];
  const diasParado = diasParadoNoLocal(pe.id, principal, movimentos);

  const partes = [];
  const rotuloEtapa = principal === "Entrada" ? "Entrada" : principal;
  partes.push(`Parad${principal === "Oficina" || principal === "Entrada" ? "a" : "o"} no ${rotuloEtapa}${diasParado !== null && diasParado > 0 ? ` há ${diasParado} dia${diasParado === 1 ? "" : "s"}` : ""}`);

  if (principal === "Corte") {
    if (pe.descanso_tecido) partes.push("tecido em descanso");
    const proc = Array.isArray(pe.processos_corte) ? pe.processos_corte : [];
    const pendentes = proc.filter((p) => !p.feito).length;
    if (pendentes > 0) partes.push(`${pendentes} processo${pendentes === 1 ? "" : "s"} pendente${pendentes === 1 ? "" : "s"}`);
  }
  if (principal === "Acabamento") {
    const proc = Array.isArray(pe.processos_acabamento) ? pe.processos_acabamento : [];
    const pendentes = proc.filter((p) => !p.feito).length;
    if (pendentes > 0) partes.push(`${pendentes} processo${pendentes === 1 ? "" : "s"} pendente${pendentes === 1 ? "" : "s"}`);
  }
  if (principal === "Oficina" && pe.oficina_id) {
    const of = oficinas.find((o) => o.id === pe.oficina_id);
    if (of) partes.push(of.nome_empresa);
  }
  return partes.join(" · ");
}

export default function Atrasos({ onNavegar }) {
  const [pedidos, setPedidos] = useState([]);
  const [movimentos, setMovimentos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [oficinas, setOficinas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroOficina, setFiltroOficina] = useState("");
  const [filtroEtapa, setFiltroEtapa] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todos"); // todos | atrasados | urgentes | 2dias | sem_prazo
  const [detalhes, setDetalhes] = useState(null);

  const carregar = useCallback(async () => {
    const [p, m, c, o] = await Promise.all([
      supabase.from("pedidos").select("*"),
      supabase.from("movimentos").select("*").order("id"),
      supabase.from("clientes").select("id, nome"),
      supabase.from("oficinas").select("id, nome_empresa"),
    ]);
    setPedidos(p.data || []);
    setMovimentos(m.data || []);
    setClientes(c.data || []);
    setOficinas(o.data || []);
    setCarregando(false);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const nomeCliente = (id) => clientes.find((c) => c.id === id)?.nome || "—";

  const analise = useMemo(() => {
    const lista = pedidos.map((pe) => {
      const s = saldos(pe.id, pe.total, movimentos);
      const emProducao = s.Entrada + s.Corte + s.Oficina + s.Acabamento;
      return { pe, s, emProducao };
    }).filter(({ emProducao }) => emProducao > 0);

    const categorizado = lista.map(({ pe, s, emProducao }) => {
      const d = diasAte(pe.prazo);
      let cat = null;
      if (d === null) cat = "sem_prazo";
      else if (d < 0) cat = "atrasados";
      else if (d <= 1) cat = "urgentes";
      else if (d <= 2) cat = "2dias";
      const motivo = motivoTravado(pe, s, movimentos, oficinas);
      const etapaPrincipal = PRODUCAO.find((et) => s[et] > 0) || null;
      return { pe, s, emProducao, dias: d, cat, motivo, etapaPrincipal };
    }).filter((x) => x.cat !== null);

    const atrasados = categorizado.filter((x) => x.cat === "atrasados");
    const urgentes = categorizado.filter((x) => x.cat === "urgentes");
    const em2dias = categorizado.filter((x) => x.cat === "2dias");
    const semPrazo = categorizado.filter((x) => x.cat === "sem_prazo");

    return { categorizado, atrasados, urgentes, em2dias, semPrazo };
  }, [pedidos, movimentos, oficinas]);

  // aplica filtros
  const filtrada = useMemo(() => {
    return analise.categorizado.filter(({ pe, etapaPrincipal, cat }) => {
      if (filtroCategoria !== "todos" && cat !== filtroCategoria) return false;
      if (filtroCliente && pe.cliente_id !== Number(filtroCliente)) return false;
      if (filtroOficina && pe.oficina_id !== Number(filtroOficina)) return false;
      if (filtroEtapa && etapaPrincipal !== filtroEtapa) return false;
      return true;
    });
  }, [analise, filtroCategoria, filtroCliente, filtroOficina, filtroEtapa]);

  // agrupamentos por urgência
  const grupos = useMemo(() => {
    const atr7 = filtrada.filter((x) => x.cat === "atrasados" && x.dias <= -7);
    const atrSemana = filtrada.filter((x) => x.cat === "atrasados" && x.dias > -7);
    const urg = filtrada.filter((x) => x.cat === "urgentes");
    const dois = filtrada.filter((x) => x.cat === "2dias");
    const sem = filtrada.filter((x) => x.cat === "sem_prazo");
    // ordena por dias (mais crítico primeiro)
    const sortAsc = (a, b) => (a.dias ?? 999) - (b.dias ?? 999);
    return {
      atr7: atr7.sort(sortAsc),
      atrSemana: atrSemana.sort(sortAsc),
      urg: urg.sort(sortAsc),
      dois: dois.sort(sortAsc),
      sem,
    };
  }, [filtrada]);

  const temFiltroAtivo = filtroCategoria !== "todos" || filtroCliente || filtroOficina || filtroEtapa;

  if (carregando) return <div style={{ padding: 28, color: "var(--text-2)" }}>Carregando…</div>;

  return (
    <div className="fade-in" style={{ padding: "20px 24px", maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Alertas</h2>
          <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 3 }}>Pedidos que precisam da sua atenção agora.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => window.print()} style={btnGhost}><Printer size={14} /> Imprimir</button>
        </div>
      </div>

      {/* 4 KPIs clicáveis (viram filtro) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 18 }}>
        <KPI
          Icon={AlertTriangle} rotulo="ATRASADOS" valor={analise.atrasados.length}
          descricao="passaram do prazo" corTexto="var(--danger)" corIcone="var(--danger)" bg="var(--danger-bg)"
          borda="var(--danger)" destaque ativo={filtroCategoria === "atrasados"}
          onClick={() => setFiltroCategoria(filtroCategoria === "atrasados" ? "todos" : "atrasados")}
        />
        <KPI
          Icon={Flame} rotulo="HOJE/AMANHÃ" valor={analise.urgentes.length}
          descricao="urgentes" corIcone="var(--warning)" bg="var(--surface)"
          ativo={filtroCategoria === "urgentes"}
          onClick={() => setFiltroCategoria(filtroCategoria === "urgentes" ? "todos" : "urgentes")}
        />
        <KPI
          Icon={Clock} rotulo="EM 2 DIAS" valor={analise.em2dias.length}
          descricao="próximo do prazo" corIcone="var(--warning)" bg="var(--surface)"
          ativo={filtroCategoria === "2dias"}
          onClick={() => setFiltroCategoria(filtroCategoria === "2dias" ? "todos" : "2dias")}
        />
        <KPI
          Icon={HelpCircle} rotulo="SEM PRAZO" valor={analise.semPrazo.length}
          descricao="pedidos sem data" corIcone="var(--text-3)" bg="var(--surface)"
          ativo={filtroCategoria === "sem_prazo"}
          onClick={() => setFiltroCategoria(filtroCategoria === "sem_prazo" ? "todos" : "sem_prazo")}
        />
      </div>

      {/* Filtros extras */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "var(--text-3)", marginRight: 4, display: "inline-flex", alignItems: "center", gap: 4 }}><Filter size={12} /> Filtrar:</span>
        <select value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)} style={selectPill}>
          <option value="">Todos os clientes</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select value={filtroOficina} onChange={(e) => setFiltroOficina(e.target.value)} style={selectPill}>
          <option value="">Todas as oficinas</option>
          {oficinas.map((o) => <option key={o.id} value={o.id}>{o.nome_empresa}</option>)}
        </select>
        <select value={filtroEtapa} onChange={(e) => setFiltroEtapa(e.target.value)} style={selectPill}>
          <option value="">Todas as etapas</option>
          {PRODUCAO.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        {temFiltroAtivo && (
          <button
            onClick={() => { setFiltroCategoria("todos"); setFiltroCliente(""); setFiltroOficina(""); setFiltroEtapa(""); }}
            style={{ ...selectPill, cursor: "pointer", border: "none", color: "var(--text-3)", display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <X size={12} /> Limpar
          </button>
        )}
      </div>

      {filtrada.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}>
          <div style={{ fontSize: 14 }}>Nenhum alerta {temFiltroAtivo ? "com esses filtros" : "no momento"}. Tudo em ordem 🌱</div>
        </div>
      )}

      {/* Atrasados +7 dias — card grande, um por vez */}
      {grupos.atr7.length > 0 && (
        <Secao cor="var(--danger)" titulo="Atrasados há mais de 7 dias" count={grupos.atr7.length}>
          {grupos.atr7.map((item) => (
            <CardCompacto key={item.pe.id} item={item} nomeCliente={nomeCliente} onAbrir={() => onNavegar?.("quadro")} onDetalhes={() => setDetalhes(item)} cor="var(--danger)" />
          ))}
        </Secao>
      )}

      {grupos.atrSemana.length > 0 && (
        <Secao cor="var(--danger)" titulo="Atrasados esta semana" count={grupos.atrSemana.length}>
          {grupos.atrSemana.map((item) => (
            <CardCompacto key={item.pe.id} item={item} nomeCliente={nomeCliente} onAbrir={() => onNavegar?.("quadro")} onDetalhes={() => setDetalhes(item)} cor="var(--danger)" />
          ))}
        </Secao>
      )}

      {grupos.urg.length > 0 && (
        <Secao cor="var(--warning)" titulo="Vencem hoje ou amanhã" count={grupos.urg.length}>
          {grupos.urg.map((item) => (
            <CardCompacto key={item.pe.id} item={item} nomeCliente={nomeCliente} onAbrir={() => onNavegar?.("quadro")} onDetalhes={() => setDetalhes(item)} cor="var(--warning)" />
          ))}
        </Secao>
      )}

      {grupos.dois.length > 0 && (
        <Secao cor="var(--warning)" titulo="Vencem em 2 dias" count={grupos.dois.length}>
          {grupos.dois.map((item) => (
            <CardCompacto key={item.pe.id} item={item} nomeCliente={nomeCliente} onAbrir={() => onNavegar?.("quadro")} onDetalhes={() => setDetalhes(item)} cor="var(--warning)" />
          ))}
        </Secao>
      )}

      {grupos.sem.length > 0 && (
        <Secao cor="var(--text-3)" titulo="Sem prazo definido" count={grupos.sem.length}>
          {grupos.sem.map((item) => (
            <CardCompacto key={item.pe.id} item={item} nomeCliente={nomeCliente} onAbrir={() => onNavegar?.("quadro")} onDetalhes={() => setDetalhes(item)} cor="var(--text-3)" />
          ))}
        </Secao>
      )}

      {detalhes && (
        <ModalDetalhes
          item={detalhes}
          nomeCliente={nomeCliente}
          oficinas={oficinas}
          movimentos={movimentos}
          onFechar={() => setDetalhes(null)}
          onAbrirQuadro={() => { setDetalhes(null); onNavegar?.("quadro"); }}
        />
      )}
    </div>
  );
}

function ModalDetalhes({ item, nomeCliente, oficinas, movimentos, onFechar, onAbrirQuadro }) {
  const { pe, s, dias, motivo } = item;
  const movsPedido = movimentos.filter((m) => m.pedido_id === pe.id).sort((a, b) => {
    const da = (a.data || a.criado_em || "");
    const db = (b.data || b.criado_em || "");
    return db.localeCompare(da);
  });

  function fmtDataHora(d) {
    if (!d) return "—";
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      return dt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return String(d); }
  }

  const procCorte = Array.isArray(pe.processos_corte) ? pe.processos_corte : [];
  const procAcab = Array.isArray(pe.processos_acabamento) ? pe.processos_acabamento : [];

  return (
    <div onClick={onFechar} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 60 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 22, position: "relative" }}>
        <button onClick={onFechar} aria-label="Fechar" style={{ position: "absolute", top: 14, right: 14, background: "transparent", border: "none", padding: 6, cursor: "pointer", color: "var(--text-3)", display: "flex", alignItems: "center", borderRadius: 6 }}><X size={18} /></button>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 6, paddingRight: 30 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{nomeCliente(pe.cliente_id)}</h3>
              {pe.marca && <span style={pillMarca}>{pe.marca}</span>}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 3 }}>{pe.referencia} · {pe.total} peça{pe.total === 1 ? "" : "s"}</div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <span style={pillAtraso}>{textoDias(dias)}</span>
            {pe.prazo && <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>Prazo: {fmtDataBR(pe.prazo)}</div>}
          </div>
        </div>

        {motivo && (
          <div style={{ padding: "10px 12px", background: "var(--danger-bg)", borderRadius: 8, margin: "14px 0", display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={16} style={{ color: "var(--danger)", flexShrink: 0 }} />
            <div style={{ fontSize: 12, color: "var(--danger)" }}><strong style={{ fontWeight: 600 }}>{motivo}</strong></div>
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Progresso das peças</div>
          <BarraProgresso s={s} total={pe.total} feitas={pe.total - (s.Entrada + s.Corte + s.Oficina + s.Acabamento)} />
        </div>

        {(pe.tamanho || pe.tecido) && (
          <div style={{ marginTop: 18, padding: "12px 14px", background: "var(--surface-2)", borderRadius: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Ficha</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, fontSize: 12 }}>
              {pe.tamanho && <div><span style={{ color: "var(--text-3)" }}>Tamanho:</span> <strong>{pe.tamanho}</strong></div>}
              {pe.tecido && <div><span style={{ color: "var(--text-3)" }}>Tecido:</span> <strong>{pe.tecido}</strong></div>}
              {pe.descanso_tecido && <div style={{ color: "var(--danger)" }}>⚠ Tecido em descanso</div>}
            </div>
          </div>
        )}

        {(procCorte.length > 0 || procAcab.length > 0) && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Processos</div>
            {procCorte.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 6 }}>Corte</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {procCorte.map((p, i) => (
                    <span key={i} style={{ fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: 99, background: p.feito ? "var(--success-bg)" : "var(--warning-bg)", color: p.feito ? "var(--success)" : "var(--warning)" }}>
                      {p.feito ? "✓" : "○"} {p.nome}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {procAcab.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 6 }}>Acabamento</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {procAcab.map((p, i) => (
                    <span key={i} style={{ fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: 99, background: p.feito ? "var(--success-bg)" : "var(--warning-bg)", color: p.feito ? "var(--success)" : "var(--warning)" }}>
                      {p.feito ? "✓" : "○"} {p.nome}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {movsPedido.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Movimentações ({movsPedido.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto", padding: "2px 4px" }}>
              {movsPedido.map((m) => (
                <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "var(--surface-2)", borderRadius: 7, fontSize: 12 }}>
                  <span style={{ color: "var(--text-2)" }}>
                    <strong style={{ color: "var(--text)" }}>{m.de_local}</strong>
                    <span style={{ margin: "0 6px", color: "var(--text-3)" }}>→</span>
                    <strong style={{ color: "var(--text)" }}>{m.para_local}</strong>
                  </span>
                  <span style={{ color: "var(--text-3)" }}>
                    <strong style={{ color: "var(--text)" }}>{m.qtd}</strong> peça{m.qtd === 1 ? "" : "s"} · {fmtDataHora(m.data || m.criado_em)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 22, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
          <button onClick={onFechar} style={{ ...btnGhostAcao, flex: 1 }}>Fechar</button>
          <button onClick={onAbrirQuadro} style={{ ...btnGhostAcao, flex: 1 }}>
            <ExternalLink size={14} /> Abrir no Quadro
          </button>
        </div>
      </div>
    </div>
  );
}

function KPI({ Icon, rotulo, valor, descricao, corTexto, corIcone, bg, borda, destaque, ativo, onClick }) {
  const bgFinal = ativo || destaque ? bg : "var(--surface)";
  const bordaFinal = destaque ? `2px solid ${borda}` : ativo ? `2px solid ${corIcone}` : "1px solid var(--border)";
  return (
    <button onClick={onClick} style={{
      textAlign: "left", padding: "14px 16px", background: bgFinal, border: bordaFinal,
      borderRadius: 12, cursor: "pointer", boxShadow: "var(--shadow-card)", transition: "transform .12s, box-shadow .15s",
    }}
    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; }}
    onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <Icon size={18} style={{ color: corIcone }} />
        <span style={{ fontSize: 10, color: corTexto || "var(--text-3)", fontWeight: 600, letterSpacing: 0.5 }}>{rotulo}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: corTexto || "var(--text)", lineHeight: 1 }}>{valor}</div>
      <div style={{ fontSize: 11, color: corTexto ? corTexto : "var(--text-2)", opacity: corTexto ? 0.85 : 1, marginTop: 4 }}>{descricao}</div>
    </button>
  );
}

function Secao({ cor, titulo, count, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: cor }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{titulo}</span>
        <span style={{ fontSize: 11, color: "var(--text-3)" }}>{count} pedido{count === 1 ? "" : "s"}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </div>
  );
}

function CardCompacto({ item, nomeCliente, onAbrir, onDetalhes, cor }) {
  const { pe, dias, motivo } = item;
  return (
    <div style={{ padding: "12px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderLeft: `3px solid ${cor}`, borderRadius: "0 12px 12px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{nomeCliente(pe.cliente_id)}</span>
          {pe.marca && <span style={pillMarca}>{pe.marca}</span>}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
          {pe.referencia} · {pe.total} peça{pe.total === 1 ? "" : "s"} · <span style={{ color: cor, fontWeight: 500 }}>{textoDias(dias)}</span>
        </div>
        {motivo && (
          <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 4, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Clock size={11} /> {motivo}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button onClick={onDetalhes} style={btnCompactoGhost} title="Ver detalhes deste pedido">
          <Eye size={12} /> Detalhes
        </button>
        <button onClick={onAbrir} style={btnCompactoGhost}>
          <ExternalLink size={12} /> Abrir
        </button>
      </div>
    </div>
  );
}

function BarraProgresso({ s, total, feitas }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: "var(--text-3)" }}>Progresso das peças</span>
        <span style={{ fontSize: 11, color: "var(--text-2)", fontWeight: 500 }}>{feitas + (s.Primeira || 0) + (s.Segunda || 0) + (s.Estoque || 0)} de {total} finalizadas</span>
      </div>
      <div style={{ display: "flex", height: 8, borderRadius: 99, overflow: "hidden", background: "var(--surface-2)", gap: 2 }}>
        {PRODUCAO.map((et) => {
          const q = s[et];
          if (q <= 0) return null;
          const pct = (q / total) * 100;
          return <div key={et} style={{ width: `${pct}%`, background: CORES_ETAPA[et] }} title={`${et} ${q}`} />;
        })}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11, color: "var(--text-3)", flexWrap: "wrap" }}>
        {PRODUCAO.filter((et) => s[et] > 0).map((et) => (
          <span key={et}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: CORES_ETAPA[et], verticalAlign: "middle", marginRight: 4 }} />
            {et} {s[et]}
          </span>
        ))}
      </div>
    </div>
  );
}

const pillMarca = { fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "var(--surface-2)", color: "var(--text-2)", fontWeight: 600 };
const pillAtraso = { fontSize: 11, padding: "3px 10px", borderRadius: 99, background: "var(--danger-bg)", color: "var(--danger)", fontWeight: 600 };
const btnGhost = { display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", fontSize: 13, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer" };
const btnDanger = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 14px", fontSize: 12, fontWeight: 600, borderRadius: 8, border: "none", background: "var(--danger)", color: "#fff", cursor: "pointer" };
const btnCompactoGhost = { display: "inline-flex", alignItems: "center", gap: 4, padding: "7px 10px", fontSize: 12, fontWeight: 600, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer" };
const btnGhostAcao = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 12, fontWeight: 600, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer" };
const btnCompactoPrimario = { display: "inline-flex", alignItems: "center", gap: 4, padding: "7px 12px", fontSize: 12, fontWeight: 600, borderRadius: 8, border: "none", color: "#fff", cursor: "pointer" };
const selectPill = { padding: "5px 10px", fontSize: 12, borderRadius: 99, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer" };
