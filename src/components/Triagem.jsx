import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient.js";
import { Plus, ImagePlus, X } from "lucide-react";
import Pilotagem from "./Pilotagem.jsx";

const STATUS = {
  em_triagem:      { label: "Em triagem",       cor: "var(--accent)",  bg: "var(--accent-bg)" },
  info_solicitada: { label: "Informações pedidas", cor: "var(--warning)", bg: "var(--warning-bg)" },
  em_pilotagem:    { label: "Em pilotagem",      cor: "var(--success)", bg: "var(--success-bg)" },
  recusada:        { label: "Recusada",          cor: "var(--danger)",  bg: "var(--danger-bg)" },
};

function formatarData(d) {
  if (!d) return "—";
  const [y, m, dd] = d.split("-");
  return `${dd}/${m}/${y}`;
}

export default function Triagem() {
  const [aba, setAba] = useState("aguardando");
  const [lista, setLista] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [oficinas, setOficinas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [nova, setNova] = useState(false);
  const [acao, setAcao] = useState(null);
  const [pilotando, setPilotando] = useState(null);
  const [comentarios, setComentarios] = useState([]);
  const [conversa, setConversa] = useState(null);

  const carregar = useCallback(async () => {
    const [s, c, o, cm] = await Promise.all([
      supabase.from("solicitacoes").select("*").order("id", { ascending: false }),
      supabase.from("clientes").select("*"),
      supabase.from("oficinas").select("*").order("nome_empresa"),
      supabase.from("comentarios_pilotagem").select("solicitacao_id, autor, id").order("id"),
    ]);
    setLista(s.data || []); setClientes(c.data || []); setOficinas(o.data || []); setComentarios(cm.data || []);
    setCarregando(false);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    const canal = supabase.channel("triagem")
      .on("postgres_changes", { event: "*", schema: "public", table: "solicitacoes" }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [carregar]);

  const nomeCliente = (id) => clientes.find((c) => c.id === id)?.nome || "—";

  async function excluir(e, s) {
    e.stopPropagation();
    if (!window.confirm("Excluir esta solicitação? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("solicitacoes").delete().eq("id", s.id);
    if (error) { window.alert("Não foi possível excluir: " + error.message); return; }
    carregar();
  }

  function ultimoAutor(solId) {
    const cs = comentarios.filter((c) => c.solicitacao_id === solId);
    return cs.length ? cs[cs.length - 1].autor : null;
  }

  if (carregando) return <div style={{ padding: 28, color: "var(--text-2)" }}>Carregando…</div>;

  const aguardando = lista.filter((s) => s.status === "em_triagem" || s.status === "info_solicitada");
  const pilotagem = lista.filter((s) => s.status === "em_pilotagem");
  const recusadas = lista.filter((s) => s.status === "recusada");
  const atual = aba === "aguardando" ? aguardando : aba === "pilotagem" ? pilotagem : recusadas;

  return (
    <div style={{ padding: "20px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>Pilotagem</h2>
        <button onClick={() => setNova(true)} style={btnPrimary}><Plus size={16} /> Nova solicitação</button>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 18, borderBottom: "1px solid var(--border)" }}>
        <button onClick={() => setAba("aguardando")} style={subTab(aba === "aguardando")}>Aguardando ({aguardando.length})</button>
        <button onClick={() => setAba("pilotagem")} style={subTab(aba === "pilotagem")}>Em pilotagem ({pilotagem.length})</button>
        <button onClick={() => setAba("recusadas")} style={subTab(aba === "recusadas")}>Recusadas ({recusadas.length})</button>
      </div>

      {atual.length === 0 ? <p style={txtVazio}>Nenhuma solicitação aqui.</p> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {atual.map((s) => {
            const st = STATUS[s.status] || STATUS.em_triagem;
            return (
              <div key={s.id} onClick={s.status === "em_pilotagem" ? () => setPilotando(s) : undefined} style={{ ...cartao, cursor: s.status === "em_pilotagem" ? "pointer" : "default" }}>
                <div style={{ display: "flex", gap: 14 }}>
                  {s.imagem_url && (
                    <a href={s.imagem_url} target="_blank" rel="noreferrer" style={{ flexShrink: 0 }}>
                      <img src={s.imagem_url} alt="Referência" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} />
                    </a>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{nomeCliente(s.cliente_id)}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: st.bg, color: st.cor }}>{st.label}</span>
                      {ultimoAutor(s.id) === "cliente" && <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: "var(--success-bg)", color: "var(--success)" }}>Cliente respondeu</span>}
                    </div>
                    <p style={{ fontSize: 13, color: "var(--text)", margin: "0 0 8px", lineHeight: 1.5 }}>{s.descricao}</p>
                    <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-3)" }}>
                      {s.quantidade != null && <span>Qtd. estimada: {s.quantidade}</span>}
                      {s.prazo_desejado && <span>Prazo desejado: {formatarData(s.prazo_desejado)}</span>}
                    </div>
                    {s.observacao_fabrica && (
                      <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 8, padding: "8px 10px", background: "var(--surface-2)", borderRadius: 8 }}>
                        <strong>Obs. da fábrica:</strong> {s.observacao_fabrica}
                      </div>
                    )}
                  </div>
                </div>

                {s.status === "em_pilotagem" && (
                  <div style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>Abrir pilotagem →</div>
                )}

                {(s.status === "em_triagem" || s.status === "info_solicitada") && (
                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    <button onClick={() => setAcao({ s, tipo: "pilotagem" })} style={btnPrimary}>Iniciar pilotagem</button>
                    <button onClick={() => setAcao({ s, tipo: "info" })} style={btnGhost}>Pedir informações</button>
                    <button onClick={() => setConversa(s)} style={btnGhost}>Abrir conversa</button>
                    <button onClick={() => setAcao({ s, tipo: "recusar" })} style={btnDanger}>Recusar</button>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                  <button onClick={(e) => excluir(e, s)} style={btnExcluir}>Excluir</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {nova && <ModalNova clientes={clientes} onFechar={() => setNova(false)} onOk={() => { setNova(false); carregar(); }} />}
      {acao && <ModalAcao dados={acao} onFechar={() => setAcao(null)} onOk={() => { setAcao(null); carregar(); }} />}
      {pilotando && <Pilotagem solicitacao={pilotando} clientes={clientes} oficinas={oficinas} onFechar={() => setPilotando(null)} onMudou={carregar} />}
      {conversa && <ConversaFabrica solicitacao={conversa} onFechar={() => setConversa(null)} />}
    </div>
  );
}

function ModalNova({ clientes, onFechar, onOk }) {
  const [clienteId, setClienteId] = useState(clientes[0]?.id || "");
  const [descricao, setDescricao] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [prazo, setPrazo] = useState("");
  const [arquivo, setArquivo] = useState(null);
  const [preview, setPreview] = useState(null);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  function onFile(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) return setErro("Selecione um arquivo de imagem.");
    if (f.size > 5 * 1024 * 1024) return setErro("Imagem muito grande (máx. 5 MB).");
    setErro(null);
    setArquivo(f);
    setPreview(URL.createObjectURL(f));
  }

  function removerImagem() {
    setArquivo(null);
    setPreview(null);
  }

  async function salvar() {
    setErro(null);
    if (!clienteId) return setErro("Escolha um cliente.");
    if (!descricao.trim()) return setErro("Descreva a solicitação.");
    setSalvando(true);

    let imagemUrl = null;
    if (arquivo) {
      const ext = (arquivo.name.split(".").pop() || "jpg").toLowerCase();
      const path = `sol-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("referencias").upload(path, arquivo);
      if (up.error) { setSalvando(false); return setErro("Falha ao enviar a imagem: " + up.error.message); }
      const { data } = supabase.storage.from("referencias").getPublicUrl(path);
      imagemUrl = data.publicUrl;
    }

    const { error } = await supabase.from("solicitacoes").insert({
      cliente_id: clienteId,
      descricao: descricao.trim(),
      quantidade: quantidade ? parseInt(quantidade, 10) : null,
      prazo_desejado: prazo || null,
      imagem_url: imagemUrl,
      status: "em_triagem",
    });
    setSalvando(false);
    if (error) return setErro(error.message);
    onOk();
  }

  return (
    <Overlay onFechar={onFechar}>
      <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 16px" }}>Nova solicitação</h3>
      <label style={lbl}>Cliente</label>
      <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} style={inp}>
        {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
      </select>
      <label style={{ ...lbl, marginTop: 14 }}>Descrição</label>
      <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} placeholder="O que o cliente quer produzir…" style={{ ...inp, resize: "vertical" }} />
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <div style={{ flex: 1 }}><label style={lbl}>Quantidade estimada</label><input type="number" min="0" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} style={inp} /></div>
        <div style={{ flex: 1 }}><label style={lbl}>Prazo desejado</label><input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} style={inp} /></div>
      </div>

      <label style={{ ...lbl, marginTop: 14 }}>Foto de referência (opcional)</label>
      {preview ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src={preview} alt="Prévia" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} />
          <button onClick={removerImagem} style={btnMini}><X size={13} /> Remover</button>
        </div>
      ) : (
        <label style={{ ...btnGhost, display: "inline-flex", cursor: "pointer" }}>
          <ImagePlus size={15} /> <span style={{ marginLeft: 6 }}>Escolher imagem</span>
          <input type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
        </label>
      )}

      {erro && <p style={erroTxt}>{erro}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <button onClick={onFechar} style={{ ...btnGhost, flex: 1 }}>Cancelar</button>
        <button onClick={salvar} disabled={salvando} style={{ ...btnPrimary, flex: 1 }}>{salvando ? "Salvando…" : "Criar"}</button>
      </div>
    </Overlay>
  );
}

function ModalAcao({ dados, onFechar, onOk }) {
  const { s, tipo } = dados;
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const config = {
    pilotagem: { titulo: "Iniciar pilotagem", texto: "Esta solicitação vai para a etapa de pilotagem.", status: "em_pilotagem", pedeObs: false, botao: "Confirmar" },
    info: { titulo: "Pedir informações", texto: "Escreva o que falta esclarecer com o cliente.", status: "info_solicitada", pedeObs: true, botao: "Enviar" },
    recusar: { titulo: "Recusar solicitação", texto: "Escreva o motivo da recusa.", status: "recusada", pedeObs: true, botao: "Recusar" },
  }[tipo];

  async function confirmar() {
    setErro(null);
    if (config.pedeObs && !obs.trim()) return setErro("Escreva uma observação.");
    setSalvando(true);
    const dadosUpd = { status: config.status };
    if (config.pedeObs) dadosUpd.observacao_fabrica = obs.trim();
    const { error } = await supabase.from("solicitacoes").update(dadosUpd).eq("id", s.id);
    setSalvando(false);
    if (error) return setErro(error.message);
    onOk();
  }

  return (
    <Overlay onFechar={onFechar}>
      <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 6px" }}>{config.titulo}</h3>
      <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 16px" }}>{config.texto}</p>
      {config.pedeObs && (
        <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} autoFocus placeholder="Escreva aqui…" style={{ ...inp, resize: "vertical" }} />
      )}
      {erro && <p style={erroTxt}>{erro}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <button onClick={onFechar} style={{ ...btnGhost, flex: 1 }}>Cancelar</button>
        <button onClick={confirmar} disabled={salvando} style={{ ...(tipo === "recusar" ? btnDanger : btnPrimary), flex: 1 }}>{salvando ? "Salvando…" : config.botao}</button>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onFechar }) {
  return (
    <div onClick={onFechar} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 22 }}>
        {children}
      </div>
    </div>
  );
}

const subTab = (ativo) => ({
  padding: "9px 14px", fontSize: 13, fontWeight: 500, border: "none", background: "none", cursor: "pointer",
  color: ativo ? "var(--accent)" : "var(--text-2)",
  borderBottom: ativo ? "2px solid var(--accent)" : "2px solid transparent", marginBottom: -1,
});
const txtVazio = { fontSize: 13, color: "var(--text-3)", padding: "16px 2px" };
const cartao = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" };
const erroTxt = { fontSize: 12, color: "var(--danger)", margin: "12px 0 0" };
function ConversaFabrica({ solicitacao, onFechar }) {
  const sol = solicitacao;
  const [comentarios, setComentarios] = useState([]);
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    const { data } = await supabase.from("comentarios_pilotagem").select("*").eq("solicitacao_id", sol.id).order("id");
    setComentarios(data || []);
    setCarregando(false);
  }, [sol.id]);
  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    const canal = supabase.channel("conversa-fab-" + sol.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "comentarios_pilotagem", filter: `solicitacao_id=eq.${sol.id}` }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [sol.id, carregar]);

  async function enviar() {
    if (!texto.trim()) return;
    setEnviando(true);
    await supabase.from("comentarios_pilotagem").insert({ solicitacao_id: sol.id, autor: "fabrica", texto: texto.trim() });
    setTexto("");
    setEnviando(false);
    carregar();
  }

  return (
    <div onClick={onFechar} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 60 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, maxHeight: "88vh", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Conversa com o cliente</div>
          <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2 }}>{sol.descricao}</div>
        </div>
        <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
          {sol.observacao_fabrica && (
            <div style={{ fontSize: 13, color: "var(--text)", padding: "10px 12px", background: "var(--surface-2)", borderRadius: 8, marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", marginBottom: 3 }}>Você pediu</div>
              {sol.observacao_fabrica}
            </div>
          )}
          {carregando ? <p style={{ fontSize: 13, color: "var(--text-3)" }}>Carregando…</p> :
            (comentarios.length === 0 && !sol.observacao_fabrica) ? <p style={{ fontSize: 13, color: "var(--text-3)" }}>Nenhuma mensagem ainda. Escreva abaixo para falar com o cliente.</p> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {comentarios.map((c) => {
                  const ehFabrica = c.autor === "fabrica";
                  return (
                    <div key={c.id} style={{ alignSelf: ehFabrica ? "flex-end" : "flex-start", maxWidth: "85%", padding: "8px 12px", borderRadius: 10, background: ehFabrica ? "var(--accent-bg)" : "var(--surface-2)" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: ehFabrica ? "var(--accent)" : "var(--success)", marginBottom: 2 }}>{ehFabrica ? "Você" : "Cliente"}</div>
                      <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{c.texto}</div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
        <div style={{ display: "flex", gap: 8, padding: "14px 20px", borderTop: "1px solid var(--border)" }}>
          <input value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") enviar(); }} placeholder="Escreva sua mensagem…" style={{ ...inp, flex: 1 }} />
          <button onClick={enviar} disabled={enviando} style={btnPrimary}>Enviar</button>
        </div>
      </div>
    </div>
  );
}

const inp = { width: "100%", padding: "9px 11px", fontSize: 14, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontFamily: "inherit" };
const lbl = { fontSize: 12, color: "var(--text-2)", display: "block", marginBottom: 5 };
const btnPrimary = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 14px", fontSize: 13, fontWeight: 600, borderRadius: 9, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" };
const btnGhost = { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "8px 14px", fontSize: 13, fontWeight: 600, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer" };
const btnDanger = { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "8px 14px", fontSize: 13, fontWeight: 600, borderRadius: 9, border: "1px solid var(--danger)", background: "var(--surface)", color: "var(--danger)", cursor: "pointer" };
const btnExcluir = { fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 7, border: "1px solid var(--danger)", background: "var(--surface)", color: "var(--danger)", cursor: "pointer" };
const btnMini = { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 500, padding: "6px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer" };
