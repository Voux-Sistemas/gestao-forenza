import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient.js";
import { Plus, ArrowRight, Package } from "lucide-react";

const LOCAIS = ["Entrada", "Corte", "Oficina", "Acabamento", "Estoque", "Perda"];
const COLUNAS = ["Entrada", "Corte", "Oficina", "Acabamento", "Estoque"];
const CORES = {
  Entrada: "var(--text-2)", Corte: "var(--accent)", Oficina: "var(--warning)",
  Acabamento: "var(--accent)", Estoque: "var(--success)", Perda: "var(--danger)",
};

function calcularSaldos(pedidoId, total, movimentos) {
  const s = { Entrada: total, Corte: 0, Oficina: 0, Acabamento: 0, Estoque: 0, Perda: 0 };
  for (const m of movimentos) {
    if (m.pedido_id !== pedidoId) continue;
    s[m.de_local] -= m.qtd;
    s[m.para_local] += m.qtd;
  }
  return s;
}

export default function Quadro({ session, perfil }) {
  const [pedidos, setPedidos] = useState([]);
  const [movimentos, setMovimentos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [oficinas, setOficinas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [mover, setMover] = useState(null);
  const [novoAberto, setNovoAberto] = useState(false);

  const carregar = useCallback(async () => {
    const [p, m, c, o] = await Promise.all([
      supabase.from("pedidos").select("*").order("id"),
      supabase.from("movimentos").select("*").order("id"),
      supabase.from("clientes").select("*").order("nome"),
      supabase.from("oficinas").select("*").order("nome_empresa"),
    ]);
    setPedidos(p.data || []); setMovimentos(m.data || []);
    setClientes(c.data || []); setOficinas(o.data || []);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    const canal = supabase.channel("quadro")
      .on("postgres_changes", { event: "*", schema: "public", table: "movimentos" }, carregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [carregar]);

  const nomeCliente = (id) => clientes.find((c) => c.id === id)?.nome || "—";
  const podeVerTudo = ["master", "chefe_geral"].includes(perfil?.papel);
  const colunas = podeVerTudo ? COLUNAS : (perfil?.setor ? [perfil.setor] : []);

  if (carregando) return <div style={{ padding: 28, color: "var(--text-2)" }}>Carregando quadro…</div>;
  if (!podeVerTudo && !perfil?.setor) return <div style={{ padding: 28, color: "var(--text-2)" }}>Seu usuário ainda não tem um setor definido.</div>;

  return (
    <div style={{ padding: "20px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>Quadro de produção</h2>
        {podeVerTudo && (
          <button onClick={() => setNovoAberto(true)} style={btnPrimary}><Plus size={16} /> Novo pedido</button>
        )}
      </div>

      <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 8, alignItems: "flex-start" }}>
        {colunas.map((local) => {
          const cards = pedidos
            .map((pe) => ({ pe, saldo: calcularSaldos(pe.id, pe.total, movimentos) }))
            .filter(({ saldo }) => saldo[local] > 0);
          return (
            <div key={local} style={coluna}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: CORES[local] }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{local}</span>
                <span style={{ fontSize: 12, color: "var(--text-3)", marginLeft: "auto" }}>{cards.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {cards.map(({ pe, saldo }) => (
                  <button key={pe.id} onClick={() => setMover({ pedido: pe, local, saldo: saldo[local] })} style={card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{pe.referencia}</span>
                      <span style={{ fontSize: 12, color: "var(--text-2)" }}>{pe.marca || ""}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-2)", margin: "3px 0 6px" }}>{nomeCliente(pe.cliente_id)}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Package size={13} style={{ color: CORES[local] }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: CORES[local] }}>{saldo[local]}</span>
                      <span style={{ fontSize: 11, color: "var(--text-3)" }}>de {pe.total}</span>
                    </div>
                    {badgesDoCard(pe, local).length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                        {badgesDoCard(pe, local).map((b, i) => (
                          <span key={i} style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 99, background: b.bg, color: b.cor }}>{b.label}</span>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
                {cards.length === 0 && <div style={{ fontSize: 12, color: "var(--text-3)", padding: "8px 2px" }}>vazio</div>}
              </div>
            </div>
          );
        })}
      </div>

      {mover && <ModalMover dados={mover} oficinas={oficinas} session={session} onFechar={() => setMover(null)} onOk={() => { setMover(null); carregar(); }} />}
      {novoAberto && <ModalNovo clientes={clientes} oficinas={oficinas} onFechar={() => setNovoAberto(false)} onOk={() => { setNovoAberto(false); carregar(); }} />}
    </div>
  );
}

function ModalMover({ dados, oficinas, session, onFechar, onOk }) {
  const { pedido, local, saldo } = dados;
  const destinos = LOCAIS.filter((l) => l !== local);
  const [destino, setDestino] = useState(destinos[0]);
  const [qtd, setQtd] = useState(saldo);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [verResumo, setVerResumo] = useState(false);
  const [oficinaId, setOficinaId] = useState(pedido.oficina_id ? String(pedido.oficina_id) : "");
  const [bloqueado, setBloqueado] = useState((local === "Corte" && corteBloqueado(pedido)) || (local === "Acabamento" && acabamentoBloqueado(pedido)));

  async function mudarOficina(novo) {
    setOficinaId(novo);
    await supabase.from("pedidos").update({ oficina_id: novo ? Number(novo) : null }).eq("id", pedido.id);
  }

  async function confirmar() {
    setErro(null);
    const q = parseInt(qtd, 10);
    if (!q || q < 1) return setErro("Quantidade inválida.");
    if (q > saldo) return setErro(`Só há ${saldo} peças em ${local}.`);
    if (bloqueado) return setErro(local === "Corte" ? "Corte travado: libere o descanso do tecido e conclua os processos pendentes antes de mover." : "Acabamento travado: conclua os processos pendentes antes de mover.");
    setSalvando(true);
    const { error } = await supabase.from("movimentos").insert({
      pedido_id: pedido.id, de_local: local, para_local: destino, qtd: q, usuario_id: session.user.id,
    });
    setSalvando(false);
    if (error) return setErro(error.message);
    onOk();
  }

  return (
    <Overlay onFechar={onFechar}>
      <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 4px" }}>Mover peças</h3>
      <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 16px" }}>{pedido.referencia} · {saldo} peças em {local}</p>
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: "var(--text-2)", display: "block", marginBottom: 5 }}>Oficina responsável</label>
        <select value={oficinaId} onChange={(e) => mudarOficina(e.target.value)} style={inpMini}>
          <option value="">— nenhuma —</option>
          {(oficinas || []).filter((o) => o.ativo).map((o) => <option key={o.id} value={String(o.id)}>{o.nome_empresa}</option>)}
        </select>
      </div>
      {local === "Corte" && <PainelCorte pedido={pedido} onBloqueioChange={setBloqueado} />}
      {local === "Acabamento" && <PainelAcabamento pedido={pedido} onBloqueioChange={setBloqueado} />}
      <label style={lbl}>Quantidade</label>
      <input type="number" min="1" max={saldo} value={qtd} onChange={(e) => setQtd(e.target.value)} style={inp} />
      <label style={{ ...lbl, marginTop: 14 }}>Enviar para</label>
      <select value={destino} onChange={(e) => setDestino(e.target.value)} style={inp}>
        {destinos.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
      {bloqueado && <p style={{ fontSize: 12, color: "var(--danger)", margin: "12px 0 0", fontWeight: 600 }}>{local === "Corte" ? "Corte travado — conclua os processos e libere o descanso para mover." : "Acabamento travado — conclua os processos para mover."}</p>}
      {erro && <p style={{ fontSize: 12, color: "var(--danger)", margin: "12px 0 0" }}>{erro}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <button onClick={onFechar} style={{ ...btnGhost, flex: 1 }}>Cancelar</button>
        <button onClick={confirmar} disabled={salvando || bloqueado} style={{ ...btnPrimary, flex: 1, opacity: bloqueado ? 0.5 : 1, cursor: bloqueado ? "not-allowed" : "pointer" }}>
          {salvando ? "Movendo…" : <>Mover <ArrowRight size={15} /></>}
        </button>
      </div>
      {pedido.solicitacao_id && (
        <button onClick={() => setVerResumo(true)} style={{ ...btnGhost, width: "100%", marginTop: 10 }}>
          Ver ficha e histórico da pilotagem
        </button>
      )}
      {verResumo && <ResumoPilotagem solicitacaoId={pedido.solicitacao_id} onFechar={() => setVerResumo(false)} />}
    </Overlay>
  );
}

function ModalNovo({ clientes, oficinas, onFechar, onOk }) {
  const [clienteId, setClienteId] = useState(clientes[0]?.id || "");
  const [oficinaId, setOficinaId] = useState("");
  const [referencia, setReferencia] = useState("");
  const [marca, setMarca] = useState("");
  const [total, setTotal] = useState("");
  const [prazo, setPrazo] = useState("");
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro(null);
    if (!clienteId) return setErro("Escolha um cliente.");
    if (!referencia.trim()) return setErro("Informe a referência.");
    const t = parseInt(total, 10);
    if (!t || t < 1) return setErro("Total de peças inválido.");
    setSalvando(true);
    const { error } = await supabase.from("pedidos").insert({
      cliente_id: clienteId, oficina_id: oficinaId || null,
      referencia: referencia.trim(), marca: marca.trim() || null, total: t, prazo: prazo || null,
    });
    setSalvando(false);
    if (error) return setErro(error.message);
    onOk();
  }

  return (
    <Overlay onFechar={onFechar}>
      <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 16px" }}>Novo pedido</h3>
      <label style={lbl}>Cliente</label>
      <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} style={inp}>
        {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
      </select>
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <div style={{ flex: 1 }}><label style={lbl}>Referência</label>
          <input value={referencia} onChange={(e) => setReferencia(e.target.value)} style={inp} /></div>
        <div style={{ flex: 1 }}><label style={lbl}>Marca</label>
          <input value={marca} onChange={(e) => setMarca(e.target.value)} style={inp} /></div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <div style={{ flex: 1 }}><label style={lbl}>Total de peças</label>
          <input type="number" min="1" value={total} onChange={(e) => setTotal(e.target.value)} style={inp} /></div>
        <div style={{ flex: 1 }}><label style={lbl}>Prazo</label>
          <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} style={inp} /></div>
      </div>
      <label style={{ ...lbl, marginTop: 14 }}>Oficina (opcional)</label>
      <select value={oficinaId} onChange={(e) => setOficinaId(e.target.value)} style={inp}>
        <option value="">— nenhuma —</option>
        {oficinas.map((o) => <option key={o.id} value={o.id}>{o.nome_empresa}</option>)}
      </select>
      {erro && <p style={{ fontSize: 12, color: "var(--danger)", margin: "12px 0 0" }}>{erro}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <button onClick={onFechar} style={{ ...btnGhost, flex: 1 }}>Cancelar</button>
        <button onClick={salvar} disabled={salvando} style={{ ...btnPrimary, flex: 1 }}>{salvando ? "Salvando…" : "Criar pedido"}</button>
      </div>
    </Overlay>
  );
}

const PROCESSOS_CORTE = ["Caseado", "Entretelado", "Estampado", "Travete", "Ilhós", "Estamparia", "Bordado", "Termo Colante"];
const PROCESSOS_ACABAMENTO = ["Caseado", "Estampado", "Travete", "Ilhós", "Termo Colante", "Plaquinha", "Zíper"];

function acabamentoBloqueado(pedido) {
  const pc = pedido.processos_acabamento || {};
  return PROCESSOS_ACABAMENTO.some((n) => !(pc[n] && pc[n].feito));
}

function corteBloqueado(pedido) {
  if (pedido.descanso_tecido) return true;
  const pc = pedido.processos_corte || {};
  return PROCESSOS_CORTE.some((n) => !(pc[n] && pc[n].feito));
}

function diasAtePrazo(prazo) {
  if (!prazo) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const partes = prazo.split("-").map(Number);
  const dt = new Date(partes[0], partes[1] - 1, partes[2]); dt.setHours(0, 0, 0, 0);
  return Math.round((dt - hoje) / 86400000);
}

function badgesDoCard(pe, local) {
  const bs = [];
  if (local === "Corte" && pe.descanso_tecido) bs.push({ label: "Tecido descansando", cor: "var(--danger)", bg: "var(--danger-bg)" });
  if (local === "Corte") {
    const pc = pe.processos_corte || {};
    const pend = PROCESSOS_CORTE.filter((n) => !(pc[n] && pc[n].feito)).length;
    if (pend > 0) bs.push({ label: pend + " pendente(s)", cor: "var(--warning)", bg: "var(--warning-bg)" });
  }
  if (local === "Acabamento") {
    const pc = pe.processos_acabamento || {};
    const pend = PROCESSOS_ACABAMENTO.filter((n) => !(pc[n] && pc[n].feito)).length;
    if (pend > 0) bs.push({ label: pend + " pendente(s)", cor: "var(--warning)", bg: "var(--warning-bg)" });
  }
  if (local !== "Estoque") {
    const dias = diasAtePrazo(pe.prazo);
    if (dias !== null) {
      if (dias < 0) bs.push({ label: "Atrasado", cor: "var(--danger)", bg: "var(--danger-bg)" });
      else if (dias === 0) bs.push({ label: "Vence hoje", cor: "var(--warning)", bg: "var(--warning-bg)" });
      else if (dias <= 2) bs.push({ label: "Vence em " + dias + "d", cor: "var(--warning)", bg: "var(--warning-bg)" });
    }
  }
  return bs;
}

function PainelCorte({ pedido, onBloqueioChange }) {
  const [tamanho, setTamanho] = useState(pedido.tamanho || "");
  const [tecido, setTecido] = useState(pedido.tecido || "");
  const [descanso, setDescanso] = useState(!!pedido.descanso_tecido);
  const [processos, setProcessos] = useState(() => {
    const base = {};
    const saved = pedido.processos_corte || {};
    PROCESSOS_CORTE.forEach((nome) => {
      const sv = saved[nome] || {};
      base[nome] = { feito: !!sv.feito, obs: sv.obs || "", data: sv.data || "" };
    });
    return base;
  });

  async function persist(campos) {
    const { error } = await supabase.from("pedidos").update(campos).eq("id", pedido.id);
    if (error) window.alert("Não foi possível salvar: " + error.message + (error.message && error.message.includes("column") ? "\n\nParece que falta rodar o SQL das colunas do corte." : ""));
  }

  function reportar(d, procs) {
    onBloqueioChange(d || PROCESSOS_CORTE.some((n) => !procs[n].feito));
  }
  useEffect(() => { reportar(descanso, processos); }, []);

  function toggleDescanso() {
    const novo = !descanso;
    setDescanso(novo);
    persist({ descanso_tecido: novo });
    reportar(novo, processos);
  }
  function toggleFeito(nome) {
    const np = { ...processos, [nome]: { ...processos[nome], feito: !processos[nome].feito } };
    setProcessos(np);
    persist({ processos_corte: np });
    reportar(descanso, np);
  }
  function mudarObs(nome, obs) {
    const data = obs.trim() ? (processos[nome].data || new Date().toLocaleDateString("pt-BR")) : "";
    setProcessos({ ...processos, [nome]: { ...processos[nome], obs, data } });
  }
  function salvarObs() { persist({ processos_corte: processos }); }
  function salvarInfo() { persist({ tamanho: tamanho.trim() || null, tecido: tecido.trim() || null }); }

  const pendentes = PROCESSOS_CORTE.filter((n) => !processos[n].feito);

  return (
    <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Liberação para o corte</div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={lblMini}>Referência</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{pedido.referencia}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={lblMini}>Tamanho</div>
          <input value={tamanho} onChange={(e) => setTamanho(e.target.value)} onBlur={salvarInfo} placeholder="P, M, G…" style={inpMini} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={lblMini}>Tecido</div>
          <input value={tecido} onChange={(e) => setTecido(e.target.value)} onBlur={salvarInfo} placeholder="malha…" style={inpMini} />
        </div>
      </div>

      <button onClick={toggleDescanso} style={{
        width: "100%", padding: "10px 12px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 14,
        border: descanso ? "1px solid var(--danger)" : "1px solid var(--border)",
        background: descanso ? "var(--danger-bg)" : "var(--surface)",
        color: descanso ? "var(--danger)" : "var(--text-2)",
      }}>
        {descanso ? "Tecido em descanso — corte travado (clique para liberar)" : "Marcar tecido em descanso"}
      </button>

      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 8 }}>Processos de corte</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {PROCESSOS_CORTE.map((nome) => {
          const pr = processos[nome];
          return (
            <div key={nome} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={pr.feito} onChange={() => toggleFeito(nome)} />
                <span style={{ fontSize: 13, fontWeight: 500, textDecoration: pr.feito ? "line-through" : "none", color: pr.feito ? "var(--text-3)" : "var(--text)" }}>{nome}</span>
                {pr.feito && <span style={{ fontSize: 11, color: "var(--success)", marginLeft: "auto" }}>concluído</span>}
              </label>
              {!pr.feito && (
                <div style={{ marginTop: 6 }}>
                  <input value={pr.obs} onChange={(e) => mudarObs(nome, e.target.value)} onBlur={salvarObs} placeholder="Pendente? escreva a observação…" style={{ ...inpMini, fontSize: 12 }} />
                  {pr.data && <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>desde {pr.data}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {pendentes.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--danger)", padding: "8px 10px", background: "var(--danger-bg)", borderRadius: 8 }}>
          {pendentes.length} processo(s) pendente(s): {pendentes.join(", ")}. As peças <strong>não podem seguir</strong> até concluir todos — registre a observação do que falta.
        </div>
      )}
    </div>
  );
}

function PainelAcabamento({ pedido, onBloqueioChange }) {
  const [processos, setProcessos] = useState(() => {
    const base = {};
    const saved = pedido.processos_acabamento || {};
    PROCESSOS_ACABAMENTO.forEach((nome) => {
      const sv = saved[nome] || {};
      base[nome] = { feito: !!sv.feito, obs: sv.obs || "", data: sv.data || "" };
    });
    return base;
  });

  async function persist(campos) {
    const { error } = await supabase.from("pedidos").update(campos).eq("id", pedido.id);
    if (error) window.alert("Não foi possível salvar: " + error.message);
  }
  function reportar(procs) { onBloqueioChange(PROCESSOS_ACABAMENTO.some((n) => !procs[n].feito)); }
  useEffect(() => { reportar(processos); }, []);

  function toggleFeito(nome) {
    const np = { ...processos, [nome]: { ...processos[nome], feito: !processos[nome].feito } };
    setProcessos(np);
    persist({ processos_acabamento: np });
    reportar(np);
  }
  function mudarObs(nome, obs) {
    const data = obs.trim() ? (processos[nome].data || new Date().toLocaleDateString("pt-BR")) : "";
    setProcessos({ ...processos, [nome]: { ...processos[nome], obs, data } });
  }
  function salvarObs() { persist({ processos_acabamento: processos }); }

  const pendentes = PROCESSOS_ACABAMENTO.filter((n) => !processos[n].feito);

  return (
    <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Processos de acabamento</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {PROCESSOS_ACABAMENTO.map((nome) => {
          const pr = processos[nome];
          return (
            <div key={nome} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={pr.feito} onChange={() => toggleFeito(nome)} />
                <span style={{ fontSize: 13, fontWeight: 500, textDecoration: pr.feito ? "line-through" : "none", color: pr.feito ? "var(--text-3)" : "var(--text)" }}>{nome}</span>
                {pr.feito && <span style={{ fontSize: 11, color: "var(--success)", marginLeft: "auto" }}>concluído</span>}
              </label>
              {!pr.feito && (
                <div style={{ marginTop: 6 }}>
                  <input value={pr.obs} onChange={(e) => mudarObs(nome, e.target.value)} onBlur={salvarObs} placeholder="Pendente? escreva a observação…" style={{ ...inpMini, fontSize: 12 }} />
                  {pr.data && <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>desde {pr.data}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {pendentes.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--danger)", padding: "8px 10px", background: "var(--danger-bg)", borderRadius: 8 }}>
          {pendentes.length} processo(s) pendente(s): {pendentes.join(", ")}. As peças <strong>não podem seguir</strong> até concluir todos.
        </div>
      )}
    </div>
  );
}

const lblMini = { fontSize: 11, color: "var(--text-3)", marginBottom: 3 };
const inpMini = { width: "100%", padding: "7px 9px", fontSize: 13, borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" };

function Overlay({ children, onFechar }) {
  return (
    <div onClick={onFechar} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 22 }}>
        {children}
      </div>
    </div>
  );
}

function ResumoPilotagem({ solicitacaoId, onFechar }) {
  const [ficha, setFicha] = useState("");
  const [descricao, setDescricao] = useState("");
  const [comentarios, setComentarios] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    (async () => {
      const sol = await supabase.from("solicitacoes").select("ficha_tecnica, descricao").eq("id", solicitacaoId).single();
      const com = await supabase.from("comentarios_pilotagem").select("*").eq("solicitacao_id", solicitacaoId).order("id");
      setFicha(sol.data?.ficha_tecnica || "");
      setDescricao(sol.data?.descricao || "");
      setComentarios(com.data || []);
      setCarregando(false);
    })();
  }, [solicitacaoId]);

  return (
    <div onClick={onFechar} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 70 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 22 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 4px" }}>Ficha e histórico da pilotagem</h3>
        {descricao && <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 16px" }}>{descricao}</p>}
        {carregando ? <p style={{ fontSize: 13, color: "var(--text-3)" }}>Carregando…</p> : (
          <>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 5 }}>Ficha técnica</div>
              <div style={{ fontSize: 13, color: "var(--text)", whiteSpace: "pre-wrap", lineHeight: 1.5, padding: "10px 12px", background: "var(--surface-2)", borderRadius: 8 }}>
                {ficha || "— sem ficha técnica —"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 8 }}>Histórico</div>
              {comentarios.length === 0 ? <p style={{ fontSize: 13, color: "var(--text-3)" }}>Sem registros.</p> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {comentarios.map((c) => {
                    const ehFabrica = c.autor === "fabrica";
                    return (
                      <div key={c.id} style={{ borderLeft: `3px solid ${ehFabrica ? "var(--accent)" : "var(--success)"}`, padding: "8px 12px", background: "var(--surface-2)", borderRadius: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: ehFabrica ? "var(--accent)" : "var(--success)" }}>{ehFabrica ? "Fábrica" : "Cliente"}</span>
                          <span style={{ fontSize: 11, color: "var(--text-3)" }}>{new Date(c.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{c.texto}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
        <button onClick={onFechar} style={{ ...btnGhost, width: "100%", marginTop: 20 }}>Fechar</button>
      </div>
    </div>
  );
}

const coluna = { minWidth: 220, width: 220, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 12 };
const card = { textAlign: "left", width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 11px", display: "block", cursor: "pointer" };
const inp = { width: "100%", padding: "9px 11px", fontSize: 14, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" };
const lbl = { fontSize: 12, color: "var(--text-2)", display: "block", marginBottom: 5 };
const btnPrimary = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 14px", fontSize: 13, fontWeight: 600, borderRadius: 9, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" };
const btnGhost = { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "9px 14px", fontSize: 13, fontWeight: 600, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer" };
