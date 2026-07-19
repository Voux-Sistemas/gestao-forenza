import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient.js";
import Overlay, { Bloco } from "./Gaveta.jsx";
import { comprimirImagem } from "../comprimirImagem.js";
import { Plus, ImagePlus, X, Trash2, Inbox, ArrowRight, MessageCircle } from "lucide-react";
import { linkWhatsApp } from "../whatsapp.js";
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

  function avisarWhatsApp(e, s) {
    e.stopPropagation();
    const c = clientes.find((x) => x.id === s.cliente_id);
    const msg = `Olá${c ? ", " + c.nome : ""}! Você tem uma atualização na sua solicitação aqui na Forenza. Dê uma olhada no portal quando puder. 🙂`;
    const url = linkWhatsApp(c?.whatsapp, msg);
    if (!url) return window.alert("Este cliente não tem WhatsApp cadastrado (ou o número está incompleto).\n\nAdicione o número com DDD em Cadastros → Clientes.");
    window.open(url, "_blank", "noopener");
  }

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
    <div className="fade-in" style={{ padding: "24px 26px", maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            Pilotagem
            {aguardando.length > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 700, padding: "3px 11px", borderRadius: 99, background: "var(--danger-bg)", color: "var(--danger)" }}>
                {aguardando.length} aguardando
              </span>
            )}
          </h2>
          <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 3 }}>
            {aguardando.length > 0
              ? `${aguardando.length} solicitação(ões) de cliente esperando sua análise.`
              : "Analise as solicitações dos clientes antes de virarem produção."}
          </div>
        </div>
        <button onClick={() => setNova(true)} style={btnPrimary}><Plus size={16} /> Nova solicitação</button>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 18, borderBottom: "1px solid var(--border)" }}>
        <button onClick={() => setAba("aguardando")} style={subTab(aba === "aguardando")}>Aguardando ({aguardando.length})</button>
        <button onClick={() => setAba("pilotagem")} style={subTab(aba === "pilotagem")}>Em pilotagem ({pilotagem.length})</button>
        <button onClick={() => setAba("recusadas")} style={subTab(aba === "recusadas")}>Recusadas ({recusadas.length})</button>
      </div>

      {atual.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "60px 0", color: "var(--text-3)" }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Inbox size={28} style={{ color: "var(--text-3)" }} />
          </div>
          <div style={{ textAlign: "center", maxWidth: 340 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-2)", marginBottom: 4 }}>
              {aba === "aguardando" ? "Tudo em dia por aqui" : aba === "pilotagem" ? "Nenhuma peça em pilotagem" : "Nenhuma solicitação recusada"}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>
              {aba === "aguardando"
                ? "Não há solicitações aguardando análise. Quando um cliente enviar um pedido pelo portal, ele aparece aqui para você avaliar."
                : aba === "pilotagem"
                ? "As solicitações aprovadas para produzir a peça-piloto aparecem nesta aba."
                : "Solicitações que você recusou ficam guardadas aqui para consulta."}
            </div>
          </div>
          {aba === "aguardando" && (
            <button onClick={() => setNova(true)} style={{ ...btnGhost, display: "inline-flex", alignItems: "center", gap: 7, marginTop: 4 }}>
              <Plus size={15} /> Criar solicitação manualmente
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {atual.map((s) => {
            const st = STATUS[s.status] || STATUS.em_triagem;
            const clicavel = s.status === "em_pilotagem";
            return (
              <div key={s.id} className={clicavel ? "lift" : ""} onClick={clicavel ? () => setPilotando(s) : undefined} style={{ ...cartao, cursor: clicavel ? "pointer" : "default" }}>
                <div style={{ display: "flex", gap: 14 }}>
                  {s.imagem_url && (
                    <a href={s.imagem_url} target="_blank" rel="noreferrer" style={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                      <img src={s.imagem_url} alt="Referência" style={{ width: 68, height: 68, objectFit: "cover", borderRadius: 10, border: "1px solid var(--border)" }} />
                    </a>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14.5, fontWeight: 700 }}>{nomeCliente(s.cliente_id)}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 9px", borderRadius: 99, background: st.bg, color: st.cor }}>{st.label}</span>
                      {ultimoAutor(s.id) === "cliente" && <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 9px", borderRadius: 99, background: "var(--success-bg)", color: "var(--success)" }}>Cliente respondeu</span>}
                      <button onClick={(e) => avisarWhatsApp(e, s)} aria-label="Avisar cliente no WhatsApp" title="Avisar cliente no WhatsApp"
                        style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 99, border: "1px solid var(--success)", background: "var(--success-bg)", color: "var(--success)", cursor: "pointer", fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>
                        <MessageCircle size={13} /> WhatsApp
                      </button>
                      <button onClick={(e) => excluir(e, s)} aria-label="Excluir solicitação" title="Excluir solicitação" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 6, borderRadius: 7, border: "1px solid transparent", background: "transparent", color: "var(--text-3)", cursor: "pointer", flexShrink: 0 }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--danger)"; e.currentTarget.style.borderColor = "var(--danger)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.borderColor = "transparent"; }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--text)", margin: "0 0 8px", lineHeight: 1.5 }}>{s.descricao}</p>
                    <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--text-3)", flexWrap: "wrap" }}>
                      {s.quantidade != null && <span>Qtd. estimada: <strong style={{ color: "var(--text-2)" }}>{s.quantidade}</strong></span>}
                      {s.prazo_desejado && <span>Prazo desejado: <strong style={{ color: "var(--text-2)" }}>{formatarData(s.prazo_desejado)}</strong></span>}
                    </div>
                    {s.observacao_fabrica && (
                      <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 8, padding: "8px 10px", background: "var(--surface-2)", borderRadius: 8 }}>
                        <strong>Obs. da fábrica:</strong> {s.observacao_fabrica}
                      </div>
                    )}
                  </div>
                </div>

                {s.status === "em_pilotagem" && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 12, paddingTop: 11, borderTop: "1px solid var(--border)", width: "100%", fontSize: 12.5, fontWeight: 700, color: "var(--accent)" }}>
                    Abrir pilotagem <ArrowRight size={14} />
                  </div>
                )}

                {(s.status === "em_triagem" || s.status === "info_solicitada") && (
                  <div style={{ display: "flex", gap: 8, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
                    <button onClick={() => setAcao({ s, tipo: "pilotagem" })} style={btnPrimary}>Iniciar pilotagem</button>
                    <button onClick={() => setConversa(s)} className="tap" style={btnGhost}>Abrir conversa</button>
                    <button onClick={() => setAcao({ s, tipo: "recusar" })} style={btnDanger}>Recusar</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {nova && <ModalNova clientes={clientes} onFechar={() => setNova(false)} onOk={() => { setNova(false); carregar(); }} />}
      {acao && <ModalAcao dados={acao} onFechar={() => setAcao(null)} onOk={() => { setAcao(null); carregar(); }} />}
      {pilotando && <Pilotagem solicitacao={pilotando} clientes={clientes} oficinas={oficinas} onFechar={() => setPilotando(null)} onMudou={carregar} />}
      {conversa && <ConversaFabrica solicitacao={conversa} cliente={clientes.find((c) => c.id === conversa.cliente_id)} onFechar={() => setConversa(null)} onMudou={carregar} />}
    </div>
  );
}

function ModalNova({ clientes, onFechar, onOk }) {
  const [clienteId, setClienteId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [prazo, setPrazo] = useState("");
  const [ficha, setFicha] = useState({ referencia: "", marca: "", produto_acabado: "", mao_de_obra: "", data_recebimento: "", prazo_piloto: "" });
  const setF = (k) => (e) => setFicha((c) => ({ ...c, [k]: e.target.value }));
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
      const up = await supabase.storage.from("referencias").upload(path, await comprimirImagem(arquivo));
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
      ficha: { ...ficha, descricao: descricao.trim() },
      status: "em_triagem",
    });
    setSalvando(false);
    if (error) return setErro(error.message);
    onOk();
  }

  return (
    <Overlay onFechar={onFechar} titulo="Nova solicitação" rodape={
      <>
        {erro && <p style={{ ...erroTxt, margin: "0 0 10px" }}>{erro}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onFechar} style={{ ...btnGhost, flex: 1 }}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} style={{ ...btnPrimary, flex: 1 }}>{salvando ? "Salvando…" : "Criar"}</button>
        </div>
      </>
    }>
      <Bloco>
        <label style={lbl}>Cliente</label>
        <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} style={inp}>
          <option value="">Selecionar…</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <label style={{ ...lbl, marginTop: 14 }}>Descrição</label>
        <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} placeholder="O que o cliente quer produzir…" style={{ ...inp, resize: "vertical" }} />
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <div style={{ flex: 1 }}><label style={lbl}>Quantidade estimada</label><input type="number" min="0" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} style={inp} /></div>
          <div style={{ flex: 1 }}><label style={lbl}>Prazo desejado</label><input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} style={inp} /></div>
        </div>
      </Bloco>

      <Bloco titulo="Ficha técnica">
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}><label style={lbl}>Referência</label><input value={ficha.referencia} onChange={setF("referencia")} placeholder="código/nome" style={inp} /></div>
          <div style={{ flex: 1 }}><label style={lbl}>Marca</label><input value={ficha.marca} onChange={setF("marca")} style={inp} /></div>
        </div>
        <label style={{ ...lbl, marginTop: 14 }}>Produto acabado</label>
        <input value={ficha.produto_acabado} onChange={setF("produto_acabado")} placeholder="ex: camiseta gola redonda" style={inp} />
        <label style={{ ...lbl, marginTop: 14 }}>Mão de obra</label>
        <input value={ficha.mao_de_obra} onChange={setF("mao_de_obra")} placeholder="ex: costura, estampa…" style={inp} />
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <div style={{ flex: 1 }}><label style={lbl}>Data de recebimento</label><input type="date" value={ficha.data_recebimento} onChange={setF("data_recebimento")} style={inp} /></div>
          <div style={{ flex: 1 }}><label style={lbl}>Prazo da peça piloto</label><input type="date" value={ficha.prazo_piloto} onChange={setF("prazo_piloto")} style={inp} /></div>
        </div>
        <label style={{ ...lbl, marginTop: 18 }}>Foto de referência (opcional)</label>
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
      </Bloco>
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
    <Overlay onFechar={onFechar} titulo={config.titulo} subtitulo={config.texto} rodape={
      <>
        {erro && <p style={{ ...erroTxt, margin: "0 0 10px" }}>{erro}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onFechar} style={{ ...btnGhost, flex: 1 }}>Cancelar</button>
          <button onClick={confirmar} disabled={salvando} style={{ ...(tipo === "recusar" ? btnDanger : btnPrimary), flex: 1 }}>{salvando ? "Salvando…" : config.botao}</button>
        </div>
      </>
    }>
      {config.pedeObs && (
        <Bloco>
          <label style={lbl}>{tipo === "recusar" ? "Motivo da recusa" : "Mensagem"}</label>
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} autoFocus placeholder="Escreva aqui…" style={{ ...inp, resize: "vertical" }} />
        </Bloco>
      )}
    </Overlay>
  );
}

const subTab = (ativo) => ({
  padding: "9px 14px", fontSize: 13, fontWeight: 500, border: "none", background: "none", cursor: "pointer",
  color: ativo ? "var(--accent)" : "var(--text-2)",
  borderBottom: ativo ? "2px solid var(--accent)" : "2px solid transparent", marginBottom: -1,
});
const cartao = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 13, padding: "15px 17px", boxShadow: "var(--shadow-sm)" };
const erroTxt = { fontSize: 12, color: "var(--danger)", margin: "12px 0 0" };
function ConversaFabrica({ solicitacao, cliente, onFechar, onMudou }) {
  const sol = solicitacao;
  const [comentarios, setComentarios] = useState([]);
  const [texto, setTexto] = useState("");
  const [imgFile, setImgFile] = useState(null);
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
    if (!texto.trim() && !imgFile) return;
    setEnviando(true);
    let imagem_url = null;
    if (imgFile) {
      const ext = (imgFile.name.split(".").pop() || "jpg").toLowerCase();
      const path = `conv-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("referencias").upload(path, await comprimirImagem(imgFile));
      if (up.error) { setEnviando(false); window.alert("Falha ao enviar a imagem: " + up.error.message); return; }
      imagem_url = supabase.storage.from("referencias").getPublicUrl(path).data.publicUrl;
    }
    await supabase.from("comentarios_pilotagem").insert({ solicitacao_id: sol.id, autor: "fabrica", texto: texto.trim(), imagem_url });
    if (sol.status === "em_triagem") {
      await supabase.from("solicitacoes").update({ status: "info_solicitada" }).eq("id", sol.id);
      if (onMudou) onMudou();
    }
    setTexto(""); setImgFile(null);
    setEnviando(false);
    carregar();
  }

  return (
    <Overlay onFechar={onFechar} largura={520} zIndex={105}
      titulo="Conversa com o cliente"
      subtitulo={sol.descricao}
      bgCorpo="var(--surface)"
      acaoTopo={
        <button onClick={() => {
          const msg = `Olá${cliente ? ", " + cliente.nome : ""}! Deixei uma mensagem para você na sua solicitação aqui na Forenza. Dê uma olhada no portal quando puder. 🙂`;
          const url = linkWhatsApp(cliente?.whatsapp, msg);
          if (!url) return window.alert("Este cliente não tem WhatsApp cadastrado (ou o número está incompleto).\n\nAdicione o número com DDD em Cadastros → Clientes.");
          window.open(url, "_blank", "noopener");
        }} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", borderRadius: 8, border: "1px solid var(--success)", background: "var(--surface)", color: "var(--success)", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
          <MessageCircle size={13} /> WhatsApp
        </button>
      }
      rodape={
        <>
          {imgFile && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 12, color: "var(--text-2)" }}>
              <img src={URL.createObjectURL(imgFile)} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6 }} />
              <span style={{ flex: 1 }}>{imgFile.name}</span>
              <button onClick={() => setImgFile(null)} style={{ ...btnGhost, padding: "4px 8px" }}>Remover</button>
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <label style={{ ...btnGhost, cursor: "pointer", display: "inline-flex", alignItems: "center", padding: "8px 12px" }}>
              <ImagePlus size={16} />
              <input type="file" accept="image/*" onChange={(e) => setImgFile(e.target.files[0] || null)} style={{ display: "none" }} />
            </label>
            <input value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") enviar(); }} placeholder="Escreva sua mensagem…" style={{ ...inp, flex: 1 }} />
            <button onClick={enviar} disabled={enviando} style={btnPrimary}>Enviar</button>
          </div>
        </>
      }>
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
                <div key={c.id} style={{ alignSelf: ehFabrica ? "flex-end" : "flex-start", maxWidth: "85%", padding: "8px 12px", borderRadius: 10, background: ehFabrica ? "var(--accent-bg)" : "var(--surface-2)", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: ehFabrica ? "var(--accent)" : "var(--success)", marginBottom: 2 }}>{ehFabrica ? "Você" : "Cliente"}</div>
                  {c.texto && <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{c.texto}</div>}
                  {c.imagem_url && <a href={c.imagem_url} target="_blank" rel="noreferrer"><img src={c.imagem_url} alt="anexo" style={{ marginTop: 6, maxWidth: "100%", maxHeight: 200, borderRadius: 8, display: "block", cursor: "pointer" }} /></a>}
                </div>
              );
            })}
          </div>
        )}
    </Overlay>
  );
}

const inp = { width: "100%", padding: "9px 11px", fontSize: 14, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontFamily: "inherit" };
const lbl = { fontSize: 12, color: "var(--text-2)", display: "block", marginBottom: 5 };
const btnPrimary = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 15px", fontSize: 13, fontWeight: 700, borderRadius: 9, border: "none", background: "linear-gradient(135deg,var(--accent),var(--accent-2))", color: "#fff", boxShadow: "var(--shadow-sm)", cursor: "pointer" };
const btnGhost = { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "9px 15px", fontSize: 13, fontWeight: 600, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer" };
const btnDanger = { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "9px 15px", fontSize: 13, fontWeight: 600, borderRadius: 9, border: "1px solid var(--danger)", background: "var(--surface)", color: "var(--danger)", cursor: "pointer" };
const btnMini = { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 500, padding: "6px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer" };
