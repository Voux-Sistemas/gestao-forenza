import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient.js";
import { comprimirImagem } from "../comprimirImagem.js";
import { Plus, ImagePlus, X } from "lucide-react";
import { PRODUCAO, calcularSaldos } from "../etapas.js";

const STATUS_SOL = {
  em_triagem:      { label: "Em análise",            cor: "var(--accent)",  bg: "var(--accent-bg)" },
  info_solicitada: { label: "Aguardando informações", cor: "var(--warning)", bg: "var(--warning-bg)" },
  em_pilotagem:    { label: "Em pilotagem",          cor: "var(--accent)",  bg: "var(--accent-bg)" },
  recusada:        { label: "Recusada",              cor: "var(--danger)",  bg: "var(--danger-bg)" },
};

function formatarData(d) {
  if (!d) return "—";
  const [y, m, dd] = d.split("-");
  return `${dd}/${m}/${y}`;
}

export default function Portal({ session, perfil }) {
  const clienteId = perfil.cliente_id;
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [movimentos, setMovimentos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [nova, setNova] = useState(false);
  const [conversa, setConversa] = useState(null);

  const carregar = useCallback(async () => {
    if (!clienteId) { setCarregando(false); return; }
    const [s, p] = await Promise.all([
      supabase.from("solicitacoes").select("*").eq("cliente_id", clienteId).order("id", { ascending: false }),
      supabase.from("pedidos").select("*").eq("cliente_id", clienteId).order("id", { ascending: false }),
    ]);
    const peds = p.data || [];
    const ids = peds.map((x) => x.id);
    const m = ids.length ? await supabase.from("movimentos").select("*").in("pedido_id", ids) : { data: [] };
    setSolicitacoes(s.data || []); setPedidos(peds); setMovimentos(m.data || []);
    setCarregando(false);
  }, [clienteId]);
  useEffect(() => { carregar(); }, [carregar]);

  if (!clienteId) {
    return <div style={{ padding: 28, color: "var(--text-2)", fontSize: 14 }}>Seu acesso ainda não está vinculado a um cliente. Fale com a fábrica.</div>;
  }
  if (carregando) return <div style={{ padding: 28, color: "var(--text-2)" }}>Carregando…</div>;

  const solAtivas = solicitacoes.filter((s) => s.status !== "aprovada");

  function statusPedido(pe) {
    const s = calcularSaldos(pe.id, pe.total, movimentos);
    const emProd = PRODUCAO.reduce((a, l) => a + s[l], 0) + s.Estoque;
    const pronto = emProd === 0;
    const concluido = pe.total - emProd;
    const pct = Math.round((concluido / pe.total) * 100);
    return { pronto, pct };
  }

  return (
    <div className="fade-in" style={{ padding: "24px 22px", maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Meus pedidos</h2>
          <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 3 }}>Acompanhe suas solicitações e a produção em tempo real.</div>
        </div>
        <button onClick={() => setNova(true)} style={btnPrimary}><Plus size={16} /> Nova solicitação</button>
      </div>

      <section style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--text-2)", margin: "0 0 10px" }}>Solicitações</h3>
        {solAtivas.length === 0 ? <p style={txtVazio}>Você ainda não tem solicitações em andamento.</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {solAtivas.map((s) => {
              const st = STATUS_SOL[s.status] || STATUS_SOL.em_triagem;
              return (
                <div key={s.id} className="lift" onClick={() => setConversa(s)} style={{ ...cartao, cursor: "pointer" }}>
                  <div style={{ display: "flex", gap: 12 }}>
                    {s.imagem_url && <img src={s.imagem_url} alt="Referência" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: st.bg, color: st.cor }}>{st.label}</span>
                      </div>
                      <p style={{ fontSize: 13, color: "var(--text)", margin: "0 0 6px", lineHeight: 1.5 }}>{s.descricao}</p>
                      <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-3)" }}>
                        {s.quantidade != null && <span>Qtd: {s.quantidade}</span>}
                        {s.prazo_desejado && <span>Prazo desejado: {formatarData(s.prazo_desejado)}</span>}
                      </div>
                      {s.observacao_fabrica && (
                        <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 8, padding: "8px 10px", background: "var(--surface-2)", borderRadius: 8 }}>
                          <strong>Mensagem da fábrica:</strong> {s.observacao_fabrica}
                        </div>
                      )}
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", marginTop: 10 }}>Ver conversa / responder →</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--text-2)", margin: "0 0 10px" }}>Em produção</h3>
        {pedidos.length === 0 ? <p style={txtVazio}>Nenhum pedido em produção ainda.</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pedidos.map((pe) => {
              const { pronto, pct } = statusPedido(pe);
              return (
                <div key={pe.id} style={cartao}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{pe.referencia}</span>
                      {pe.marca && <span style={{ fontSize: 12, color: "var(--text-2)", marginLeft: 8 }}>{pe.marca}</span>}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: pronto ? "var(--success-bg)" : "var(--accent-bg)", color: pronto ? "var(--success)" : "var(--accent)" }}>
                      {pronto ? "Pronto" : "Em produção"}
                    </span>
                  </div>
                  <div style={{ height: 8, background: "var(--surface-3)", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: pronto ? "var(--success)" : "linear-gradient(90deg,var(--accent),var(--accent-2))", transition: "width .4s cubic-bezier(.2,.7,.3,1)" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12, color: "var(--text-3)" }}>
                    <span>{pe.total} peças</span>
                    <span>{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {nova && <ModalNova clienteId={clienteId} onFechar={() => setNova(false)} onOk={() => { setNova(false); carregar(); }} />}
      {conversa && <ModalConversa solicitacao={conversa} onFechar={() => setConversa(null)} />}
    </div>
  );
}

function ModalNova({ clienteId, onFechar, onOk }) {
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

  async function salvar() {
    setErro(null);
    if (!descricao.trim()) return setErro("Descreva o que você precisa.");
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
      status: "em_triagem",
    });
    setSalvando(false);
    if (error) return setErro(error.message);
    onOk();
  }

  return (
    <div onClick={onFechar} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} className="pop" style={{ width: "100%", maxWidth: 440, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 22, boxShadow: "var(--shadow-lg)" }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 4px" }}>Nova solicitação</h3>
        <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 16px" }}>Conte o que você precisa produzir. A fábrica vai analisar.</p>
        <label style={lbl}>Descrição</label>
        <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} placeholder="O que você quer produzir…" style={{ ...inp, resize: "vertical" }} />
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <div style={{ flex: 1 }}><label style={lbl}>Quantidade</label><input type="number" min="0" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} style={inp} /></div>
          <div style={{ flex: 1 }}><label style={lbl}>Prazo desejado</label><input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} style={inp} /></div>
        </div>
        <label style={{ ...lbl, marginTop: 14 }}>Foto de referência (opcional)</label>
        {preview ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src={preview} alt="Prévia" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} />
            <button onClick={() => { setArquivo(null); setPreview(null); }} style={btnMini}><X size={13} /> Remover</button>
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
          <button onClick={salvar} disabled={salvando} style={{ ...btnPrimary, flex: 1 }}>{salvando ? "Enviando…" : "Enviar"}</button>
        </div>
      </div>
    </div>
  );
}

function ModalConversa({ solicitacao, onFechar }) {
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
    const canal = supabase.channel("conversa-cli-" + sol.id)
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
    await supabase.from("comentarios_pilotagem").insert({ solicitacao_id: sol.id, autor: "cliente", texto: texto.trim(), imagem_url });
    setTexto(""); setImgFile(null);
    setEnviando(false);
    carregar();
  }

  return (
    <div onClick={onFechar} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 60 }}>
      <div onClick={(e) => e.stopPropagation()} className="pop" style={{ width: "100%", maxWidth: 520, maxHeight: "88vh", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, display: "flex", flexDirection: "column", boxShadow: "var(--shadow-lg)" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Sua solicitação</div>
          <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2 }}>{sol.descricao}</div>
        </div>
        <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
          {sol.observacao_fabrica && (
            <div style={{ fontSize: 13, color: "var(--text)", padding: "10px 12px", background: "var(--surface-2)", borderRadius: 8, marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", marginBottom: 3 }}>Fábrica</div>
              {sol.observacao_fabrica}
            </div>
          )}
          {carregando ? <p style={{ fontSize: 13, color: "var(--text-3)" }}>Carregando…</p> :
            (comentarios.length === 0 && !sol.observacao_fabrica) ? <p style={{ fontSize: 13, color: "var(--text-3)" }}>Nenhuma mensagem ainda. Escreva abaixo para falar com a fábrica.</p> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {comentarios.map((c) => {
                  const ehCliente = c.autor === "cliente";
                  return (
                    <div key={c.id} style={{ alignSelf: ehCliente ? "flex-end" : "flex-start", maxWidth: "85%", padding: "8px 12px", borderRadius: 10, background: ehCliente ? "var(--accent-bg)" : "var(--surface-2)" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: ehCliente ? "var(--accent)" : "var(--text-2)", marginBottom: 2 }}>{ehCliente ? "Você" : "Fábrica"}</div>
                      {c.texto && <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{c.texto}</div>}
                      {c.imagem_url && <a href={c.imagem_url} target="_blank" rel="noreferrer"><img src={c.imagem_url} alt="anexo" style={{ marginTop: 6, maxWidth: "100%", maxHeight: 200, borderRadius: 8, display: "block", cursor: "pointer" }} /></a>}
                    </div>
                  );
                })}
              </div>
            )}
        </div>
        <div style={{ borderTop: "1px solid var(--border)", padding: "14px 20px" }}>
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
            <input value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") enviar(); }} placeholder="Escreva sua resposta…" style={{ ...inp, flex: 1 }} />
            <button onClick={enviar} disabled={enviando} style={btnPrimary}>Enviar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const txtVazio = { fontSize: 13, color: "var(--text-3)", padding: "8px 2px" };
const cartao = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 13, padding: "15px 17px", boxShadow: "var(--shadow-sm)" };
const erroTxt = { fontSize: 12, color: "var(--danger)", margin: "12px 0 0" };
const inp = { width: "100%", padding: "9px 11px", fontSize: 14, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontFamily: "inherit" };
const lbl = { fontSize: 12, color: "var(--text-2)", display: "block", marginBottom: 5 };
const btnPrimary = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 15px", fontSize: 13, fontWeight: 700, borderRadius: 9, border: "none", background: "linear-gradient(135deg,var(--accent),var(--accent-2))", color: "#fff", boxShadow: "var(--shadow-sm)", cursor: "pointer" };
const btnGhost = { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "8px 14px", fontSize: 13, fontWeight: 600, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer" };
const btnMini = { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 500, padding: "6px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer" };
