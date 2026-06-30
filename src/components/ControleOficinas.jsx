import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Factory, ArrowUpRight, ArrowDownLeft, Calendar, AlertTriangle, X, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "../supabaseClient.js";

const LOCAIS_PRE_OFICINA = ["Entrada", "Corte"];      // de onde podem sair peças pra oficina
const DESTINOS_POS_OFICINA = ["Acabamento", "Estoque", "Perda"];

function diasEntre(de, ate) {
  if (!de) return 0;
  const [y1, m1, d1] = de.split("-").map(Number);
  const dA = new Date(y1, m1 - 1, d1); dA.setHours(0, 0, 0, 0);
  let dB;
  if (ate) {
    const [y2, m2, d2] = ate.split("-").map(Number);
    dB = new Date(y2, m2 - 1, d2); dB.setHours(0, 0, 0, 0);
  } else {
    dB = new Date(); dB.setHours(0, 0, 0, 0);
  }
  return Math.round((dB - dA) / 86400000);
}

function fmtData(d) {
  if (!d) return "—";
  const p = d.split("-");
  return p[2] + "/" + p[1] + "/" + p[0];
}

function calcularSaldos(pedidoId, total, movimentos) {
  const s = { Entrada: total, Corte: 0, Oficina: 0, Acabamento: 0, Estoque: 0, Perda: 0 };
  for (const m of movimentos) {
    if (m.pedido_id !== pedidoId) continue;
    s[m.de_local] -= m.qtd;
    s[m.para_local] += m.qtd;
  }
  return s;
}

export default function ControleOficinas({ session, perfil }) {
  const [pedidos, setPedidos] = useState([]);
  const [movimentos, setMovimentos] = useState([]);
  const [oficinas, setOficinas] = useState([]);
  const [remessas, setRemessas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [novaSaida, setNovaSaida] = useState(false);
  const [retornar, setRetornar] = useState(null); // remessa selecionada
  const [expandida, setExpandida] = useState(null); // id da remessa expandida

  const carregar = useCallback(async () => {
    const [p, m, o, r, c] = await Promise.all([
      supabase.from("pedidos").select("*").order("id", { ascending: false }),
      supabase.from("movimentos").select("*").order("id"),
      supabase.from("oficinas").select("*").eq("ativo", true).order("nome_empresa"),
      supabase.from("remessas_oficina").select("*").order("id", { ascending: false }),
      supabase.from("clientes").select("id, nome"),
    ]);
    setPedidos(p.data || []);
    setMovimentos(m.data || []);
    setOficinas(o.data || []);
    setRemessas(r.data || []);
    setClientes(c.data || []);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    const canal = supabase.channel("controle-oficinas")
      .on("postgres_changes", { event: "*", schema: "public", table: "remessas_oficina" }, carregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "movimentos" }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [carregar]);

  const nomeCliente = (id) => clientes.find((c) => c.id === id)?.nome || "—";
  const nomeOficina = (id) => oficinas.find((o) => o.id === id)?.nome_empresa || "—";

  const abertas = useMemo(() => remessas.filter((r) => !r.data_fechamento), [remessas]);
  const fechadasRecentes = useMemo(() => remessas.filter((r) => r.data_fechamento).slice(0, 20), [remessas]);

  // Agrupa abertas por oficina
  const porOficina = useMemo(() => {
    const mapa = {};
    abertas.forEach((r) => {
      if (!mapa[r.oficina_id]) mapa[r.oficina_id] = [];
      mapa[r.oficina_id].push(r);
    });
    return mapa;
  }, [abertas]);

  const totalAbertas = abertas.length;
  const totalPecasFora = abertas.reduce((s, r) => s + (r.qtd_enviada - r.qtd_retornada), 0);
  const remessasAtrasadas = abertas.filter((r) => diasEntre(r.data_saida, null) > 7).length;

  if (carregando) return <div style={{ padding: 28, color: "var(--text-2)" }}>Carregando…</div>;

  return (
    <div style={{ padding: 28, maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Controle de oficinas</h2>
          <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 3 }}>Registre saídas e retornos de peças das oficinas terceirizadas.</div>
        </div>
        <button onClick={() => setNovaSaida(true)} style={btnPrimary}><Plus size={16} /> Registrar saída</button>
      </div>

      <div style={{ display: "flex", gap: 14, marginBottom: 22, flexWrap: "wrap" }}>
        <Stat Icon={ArrowUpRight} label="Remessas em aberto" valor={totalAbertas} cor="var(--warning)" bg="var(--warning-bg)" />
        <Stat Icon={Factory} label="Peças fora da fábrica" valor={totalPecasFora} cor="var(--accent)" bg="var(--accent-bg)" />
        <Stat Icon={AlertTriangle} label="Em atraso (+7 dias)" valor={remessasAtrasadas} cor="var(--danger)" bg="var(--danger-bg)" />
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 12px" }}>Em aberto</h3>
      {abertas.length === 0 ? (
        <div style={{ padding: 20, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text-3)", fontSize: 13 }}>Nenhuma remessa em aberto no momento.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 }}>
          {Object.keys(porOficina).map((ofId) => (
            <div key={ofId} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, boxShadow: "var(--shadow-card)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Factory size={16} style={{ color: "var(--accent)" }} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>{nomeOficina(Number(ofId))}</span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "1px 8px", borderRadius: 99, background: "var(--surface-2)", color: "var(--text-2)" }}>{porOficina[ofId].length} remessa(s)</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {porOficina[ofId].map((r) => {
                  const ped = pedidos.find((p) => p.id === r.pedido_id);
                  const d = diasEntre(r.data_saida, null);
                  const restante = r.qtd_enviada - r.qtd_retornada;
                  const atrasada = d > 7;
                  const aberto = expandida === r.id;
                  // movimentos dessa remessa, ordenados por data
                  const movsRemessa = movimentos.filter((m) => m.remessa_id === r.id).sort((a, b) => {
                    const da = (a.data || a.criado_em || "").slice(0, 10);
                    const db = (b.data || b.criado_em || "").slice(0, 10);
                    return da.localeCompare(db);
                  });
                  return (
                    <div key={r.id} style={{ border: "1px solid var(--border)", borderRadius: 9, background: "var(--surface-2)", overflow: "hidden" }}>
                      <div style={{ padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <button onClick={() => setExpandida(aberto ? null : r.id)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "none", padding: 0, cursor: "pointer", color: "var(--text)", minWidth: 200, textAlign: "left" }}>
                          {aberto ? <ChevronDown size={14} style={{ color: "var(--text-3)" }} /> : <ChevronRight size={14} style={{ color: "var(--text-3)" }} />}
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{ped?.referencia || "#" + r.pedido_id}{ped?.marca ? ` · ${ped.marca}` : ""}</div>
                            <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>{ped ? nomeCliente(ped.cliente_id) : ""}</div>
                          </div>
                        </button>
                        <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Calendar size={11} /> Saiu {fmtData(r.data_saida)}</span>
                          <span style={{ marginLeft: 12, fontWeight: 600, color: atrasada ? "var(--danger)" : "var(--text-2)" }}>{d} dia{d === 1 ? "" : "s"}{atrasada ? " — atrasada" : ""}</span>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--danger)" }}>faltam {restante} <span style={{ color: "var(--text-3)", fontWeight: 400 }}>de {r.qtd_enviada}</span></div>
                        <button onClick={() => setRetornar({ remessa: r, pedido: ped })} style={btnMini}><ArrowDownLeft size={13} /> Registrar retorno</button>
                      </div>
                      {aberto && (
                        <div style={{ padding: "10px 14px 12px 32px", borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
                          <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 7 }}>Histórico desta remessa</div>
                          {movsRemessa.length === 0 ? (
                            <div style={{ fontSize: 12, color: "var(--text-3)" }}>Sem movimentações ainda.</div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                              {movsRemessa.map((m) => {
                                const ehSaida = m.para_local === "Oficina";
                                return (
                                  <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "5px 0" }}>
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                      {ehSaida
                                        ? <ArrowUpRight size={13} style={{ color: "var(--accent)" }} />
                                        : <ArrowDownLeft size={13} style={{ color: "var(--success)" }} />}
                                      <span style={{ color: "var(--text-2)" }}>
                                        {ehSaida ? "Saiu" : "Voltou"} em <strong style={{ color: "var(--text)" }}>{fmtData((m.data || m.criado_em || "").slice(0, 10))}</strong>
                                      </span>
                                    </span>
                                    <span style={{ color: "var(--text-2)" }}>
                                      <strong style={{ color: "var(--text)" }}>{m.qtd}</strong> peça(s) <span style={{ color: "var(--text-3)" }}>{ehSaida ? `(de ${m.de_local})` : `→ ${m.para_local}`}</span>
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 12px" }}>Fechadas recentemente</h3>
      {fechadasRecentes.length === 0 ? (
        <div style={{ padding: 20, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text-3)", fontSize: 13 }}>Nenhuma remessa fechada ainda.</div>
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", boxShadow: "var(--shadow-card)" }}>
          <div style={{ display: "flex", padding: "10px 14px", borderBottom: "1px solid var(--border)", background: "var(--surface-2)", fontSize: 11, fontWeight: 600, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            <span style={{ flex: 2 }}>Pedido</span>
            <span style={{ flex: 1.4 }}>Oficina</span>
            <span style={{ flex: 1 }}>Saída</span>
            <span style={{ flex: 1 }}>Retorno</span>
            <span style={{ flex: 0.8 }}>Dias</span>
            <span style={{ flex: 0.8 }}>Peças</span>
          </div>
          {fechadasRecentes.map((r) => {
            const ped = pedidos.find((p) => p.id === r.pedido_id);
            const d = diasEntre(r.data_saida, r.data_fechamento);
            return (
              <div key={r.id} style={{ display: "flex", padding: "10px 14px", borderTop: "1px solid var(--border)", fontSize: 12.5 }}>
                <span style={{ flex: 2, fontWeight: 600 }}>{ped?.referencia || "#" + r.pedido_id}</span>
                <span style={{ flex: 1.4, color: "var(--text-2)" }}>{nomeOficina(r.oficina_id)}</span>
                <span style={{ flex: 1, color: "var(--text-2)" }}>{fmtData(r.data_saida)}</span>
                <span style={{ flex: 1, color: "var(--text-2)" }}>{fmtData(r.data_fechamento)}</span>
                <span style={{ flex: 0.8, color: "var(--text-2)" }}>{d}</span>
                <span style={{ flex: 0.8, color: "var(--text-2)" }}>{r.qtd_enviada}</span>
              </div>
            );
          })}
        </div>
      )}

      {novaSaida && <ModalNovaSaida pedidos={pedidos} oficinas={oficinas} movimentos={movimentos} clientes={clientes} session={session} onFechar={() => setNovaSaida(false)} onOk={() => { setNovaSaida(false); carregar(); }} />}
      {retornar && <ModalRegistrarRetorno dados={retornar} session={session} onFechar={() => setRetornar(null)} onOk={() => { setRetornar(null); carregar(); }} />}
    </div>
  );
}

function Stat({ Icon, label, valor, cor, bg }) {
  return (
    <div style={{ flex: "1 1 180px", padding: "16px 18px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, boxShadow: "var(--shadow-card)", display: "flex", alignItems: "flex-start", gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={18} style={{ color: cor }} />
      </div>
      <div>
        <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{valor}</div>
      </div>
    </div>
  );
}

// === Modal: registrar saída pra oficina ===
function ModalNovaSaida({ pedidos, oficinas, movimentos, clientes, session, onFechar, onOk }) {
  const [pedidoId, setPedidoId] = useState("");
  const [oficinaId, setOficinaId] = useState("");
  const [qtd, setQtd] = useState("");
  const [origem, setOrigem] = useState("Corte");
  const [dataSaida, setDataSaida] = useState(new Date().toISOString().slice(0, 10));
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  // Lista pedidos em produção (têm peças em Entrada, Corte ou Oficina)
  const pedidosDisponiveis = useMemo(() => {
    return pedidos
      .map((p) => ({ p, saldo: calcularSaldos(p.id, p.total, movimentos) }))
      .filter(({ saldo }) => saldo.Entrada > 0 || saldo.Corte > 0);
  }, [pedidos, movimentos]);

  const pedidoSelecionado = pedidosDisponiveis.find((x) => x.p.id === Number(pedidoId));
  const saldoOrigem = pedidoSelecionado ? pedidoSelecionado.saldo[origem] : 0;

  async function confirmar() {
    setErro(null);
    if (!pedidoId) return setErro("Escolha o pedido.");
    if (!oficinaId) return setErro("Escolha a oficina.");
    const q = parseInt(qtd, 10);
    if (!q || q < 1) return setErro("Quantidade inválida.");
    if (q > saldoOrigem) return setErro(`Só há ${saldoOrigem} peças em ${origem} desse pedido.`);

    setSalvando(true);
    // 1) cria a remessa
    const r = await supabase.from("remessas_oficina").insert({
      pedido_id: Number(pedidoId), oficina_id: Number(oficinaId),
      qtd_enviada: q, data_saida: dataSaida,
    }).select().single();
    if (r.error) { setSalvando(false); return setErro("Falha ao criar a remessa: " + r.error.message); }
    // 2) cria o movimento (usa a data informada)
    const m = await supabase.from("movimentos").insert({
      pedido_id: Number(pedidoId), de_local: origem, para_local: "Oficina", qtd: q,
      usuario_id: session.user.id, remessa_id: r.data.id, data: dataSaida,
    });
    if (m.error) { setSalvando(false); return setErro("Falha ao registrar a movimentação: " + m.error.message); }
    // 3) atualiza o pedido com a oficina responsável (mantém compatibilidade com o resto do sistema)
    await supabase.from("pedidos").update({ oficina_id: Number(oficinaId) }).eq("id", Number(pedidoId));
    setSalvando(false);
    onOk();
  }

  return (
    <Overlay onFechar={onFechar}>
      <h3 style={tituloModal}>Registrar saída para oficina</h3>
      <label style={lbl}>Pedido</label>
      <select value={pedidoId} onChange={(e) => setPedidoId(e.target.value)} autoFocus style={inp}>
        <option value="">— selecione —</option>
        {pedidosDisponiveis.map(({ p, saldo }) => {
          const cli = clientes.find((c) => c.id === p.cliente_id)?.nome || "—";
          return <option key={p.id} value={p.id}>{p.referencia} — {cli} (Entrada: {saldo.Entrada}, Corte: {saldo.Corte})</option>;
        })}
      </select>

      <label style={{ ...lbl, marginTop: 12 }}>Saindo de</label>
      <select value={origem} onChange={(e) => setOrigem(e.target.value)} style={inp}>
        {LOCAIS_PRE_OFICINA.map((l) => <option key={l} value={l}>{l}</option>)}
      </select>
      {pedidoSelecionado && <p style={{ fontSize: 11.5, color: "var(--text-3)", margin: "4px 0 0" }}>Disponível em {origem}: <strong>{saldoOrigem}</strong> peça(s)</p>}

      <label style={{ ...lbl, marginTop: 12 }}>Oficina</label>
      <select value={oficinaId} onChange={(e) => setOficinaId(e.target.value)} style={inp}>
        <option value="">— selecione —</option>
        {oficinas.map((o) => <option key={o.id} value={o.id}>{o.nome_empresa}</option>)}
      </select>

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={lbl}>Quantidade</label>
          <input type="number" min="1" max={saldoOrigem || undefined} value={qtd} onChange={(e) => setQtd(e.target.value)} style={inp} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={lbl}>Data da saída</label>
          <input type="date" value={dataSaida} onChange={(e) => setDataSaida(e.target.value)} style={inp} />
        </div>
      </div>

      {erro && <p style={erroTxt}>{erro}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
        <button onClick={onFechar} style={{ ...btnGhost, flex: 1 }}>Cancelar</button>
        <button onClick={confirmar} disabled={salvando} style={{ ...btnPrimary, flex: 1 }}>{salvando ? "Salvando…" : "Registrar saída"}</button>
      </div>
    </Overlay>
  );
}

// === Modal: registrar retorno da oficina ===
function ModalRegistrarRetorno({ dados, session, onFechar, onOk }) {
  const { remessa, pedido } = dados;
  const restante = remessa.qtd_enviada - remessa.qtd_retornada;
  const [qtd, setQtd] = useState(String(restante));
  const [destino, setDestino] = useState("Acabamento");
  const [dataRetorno, setDataRetorno] = useState(new Date().toISOString().slice(0, 10));
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  async function confirmar() {
    setErro(null);
    const q = parseInt(qtd, 10);
    if (!q || q < 1) return setErro("Quantidade inválida.");
    if (q > restante) return setErro(`Essa remessa tem ${restante} peça(s) em aberto.`);

    setSalvando(true);
    const novaQtdRet = remessa.qtd_retornada + q;
    const fechada = novaQtdRet >= remessa.qtd_enviada;
    // 1) abate a remessa
    const up = await supabase.from("remessas_oficina").update({
      qtd_retornada: novaQtdRet,
      data_fechamento: fechada ? dataRetorno : null,
    }).eq("id", remessa.id);
    if (up.error) { setSalvando(false); return setErro("Falha ao abater a remessa: " + up.error.message); }
    // 2) cria o movimento (usa a data informada)
    const m = await supabase.from("movimentos").insert({
      pedido_id: remessa.pedido_id, de_local: "Oficina", para_local: destino, qtd: q,
      usuario_id: session.user.id, remessa_id: remessa.id, data: dataRetorno,
    });
    if (m.error) { setSalvando(false); return setErro("Falha ao registrar a movimentação: " + m.error.message); }
    setSalvando(false);
    onOk();
  }

  return (
    <Overlay onFechar={onFechar}>
      <h3 style={tituloModal}>Registrar retorno</h3>
      <div style={{ padding: "10px 12px", background: "var(--surface-2)", borderRadius: 9, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{pedido?.referencia || "#" + remessa.pedido_id}</div>
        <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 2 }}>Saiu {fmtData(remessa.data_saida)} · Enviadas {remessa.qtd_enviada} · Retornaram {remessa.qtd_retornada} · <strong>Faltam {restante}</strong></div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={lbl}>Peças retornando</label>
          <input type="number" min="1" max={restante} value={qtd} onChange={(e) => setQtd(e.target.value)} autoFocus style={inp} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={lbl}>Data do retorno</label>
          <input type="date" value={dataRetorno} onChange={(e) => setDataRetorno(e.target.value)} style={inp} />
        </div>
      </div>

      <label style={{ ...lbl, marginTop: 12 }}>Destino na fábrica</label>
      <select value={destino} onChange={(e) => setDestino(e.target.value)} style={inp}>
        {DESTINOS_POS_OFICINA.map((l) => <option key={l} value={l}>{l}</option>)}
      </select>

      {erro && <p style={erroTxt}>{erro}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
        <button onClick={onFechar} style={{ ...btnGhost, flex: 1 }}>Cancelar</button>
        <button onClick={confirmar} disabled={salvando} style={{ ...btnPrimary, flex: 1 }}>{salvando ? "Salvando…" : "Registrar retorno"}</button>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onFechar }) {
  return (
    <div onClick={onFechar} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 60 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, position: "relative" }}>
        <button onClick={onFechar} aria-label="Fechar" style={{ position: "absolute", top: 12, right: 12, background: "transparent", border: "none", padding: 6, cursor: "pointer", color: "var(--text-3)", display: "flex", alignItems: "center", borderRadius: 6 }}><X size={16} /></button>
        {children}
      </div>
    </div>
  );
}

const lbl = { fontSize: 12, color: "var(--text-2)", display: "block", marginBottom: 5, fontWeight: 500 };
const inp = { width: "100%", padding: "10px 12px", fontSize: 14, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", boxSizing: "border-box" };
const btnPrimary = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, borderRadius: 9, border: "none", background: "linear-gradient(135deg,var(--accent),var(--accent-2))", color: "#fff", boxShadow: "var(--shadow-sm)", cursor: "pointer" };
const btnGhost = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 14px", fontSize: 13, fontWeight: 600, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer" };
const btnMini = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "6px 10px", fontSize: 12, fontWeight: 600, borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", cursor: "pointer" };
const tituloModal = { fontSize: 15, fontWeight: 600, margin: "0 0 16px" };
const erroTxt = { fontSize: 12, color: "var(--danger)", margin: "10px 0 0" };
