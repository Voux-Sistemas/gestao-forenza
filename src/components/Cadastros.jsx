import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient.js";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config.js";
import { Plus, Pencil, Eye, Trash2 } from "lucide-react";

export default function Cadastros() {
  const [aba, setAba] = useState("clientes");
  return (
    <div style={{ padding: "20px 22px" }}>
      <h2 style={{ fontSize: 17, fontWeight: 600, margin: "0 0 16px" }}>Cadastros</h2>
      <div style={{ display: "flex", gap: 4, marginBottom: 18, borderBottom: "1px solid var(--border)" }}>
        {[["clientes", "Clientes"], ["oficinas", "Oficinas"]].map(([id, label]) => (
          <button key={id} onClick={() => setAba(id)} style={subTab(aba === id)}>{label}</button>
        ))}
      </div>
      {aba === "clientes" ? <Clientes /> : <Oficinas />}
    </div>
  );
}

function Clientes() {
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [novo, setNovo] = useState(false);
  const [selecionado, setSelecionado] = useState(null);
  const [editarInicial, setEditarInicial] = useState(false);

  const carregar = useCallback(async () => {
    const { data } = await supabase.from("clientes").select("*").order("nome");
    setLista(data || []);
    setCarregando(false);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function alternar(e, c) {
    e.stopPropagation();
    await supabase.from("clientes").update({ ativo: !c.ativo }).eq("id", c.id);
    carregar();
  }

  async function excluir(e, c) {
    e.stopPropagation();
    if (!window.confirm(`Excluir o cliente "${c.nome}"? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from("clientes").delete().eq("id", c.id);
    if (error) {
      window.alert("Não foi possível excluir: este cliente tem pedidos ou solicitações no sistema. Use \"Desativar\" para ocultá-lo sem perder o histórico.");
      return;
    }
    carregar();
  }

  function abrir(c, editar) {
    setSelecionado(c);
    setEditarInicial(editar);
  }

  if (carregando) return <p style={txtVazio}>Carregando…</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button onClick={() => setNovo(true)} style={btnPrimary}><Plus size={16} /> Novo cliente</button>
      </div>
      {lista.length === 0 ? <p style={txtVazio}>Nenhum cliente cadastrado.</p> : (
        <div style={tabela}>
          <div style={{ ...linha, ...cabecalho }}>
            <span style={{ flex: 2 }}>Nome</span>
            <span style={{ flex: 2 }}>Contato</span>
            <span style={{ flex: 1 }}>Status</span>
            <span style={{ width: 210, textAlign: "right" }}></span>
          </div>
          {lista.map((c) => (
            <div key={c.id} onClick={() => setSelecionado(c)} style={{ ...linha, cursor: "pointer" }}>
              <span style={{ flex: 2, fontWeight: 500 }}>{c.nome}</span>
              <span style={{ flex: 2, color: "var(--text-2)" }}>{c.contato || "—"}</span>
              <span style={{ flex: 1 }}><Badge ativo={c.ativo} /></span>
              <span style={{ width: 210, display: "flex", justifyContent: "flex-end", gap: 6 }}>
                <button onClick={(e) => { e.stopPropagation(); abrir(c, false); }} style={btnIcon} aria-label="Ver detalhes"><Eye size={15} /></button>
                <button onClick={(e) => { e.stopPropagation(); abrir(c, true); }} style={btnIcon} aria-label="Editar"><Pencil size={15} /></button>
                <button onClick={(e) => alternar(e, c)} style={btnMini}>{c.ativo ? "Desativar" : "Ativar"}</button>
                <button onClick={(e) => excluir(e, c)} style={btnIconDanger} aria-label="Excluir"><Trash2 size={15} /></button>
              </span>
            </div>
          ))}
        </div>
      )}
      {novo && <DetalheCliente registro={null} onFechar={() => setNovo(false)} onSalvo={() => { setNovo(false); carregar(); }} />}
      {selecionado && <DetalheCliente registro={selecionado} editarInicial={editarInicial} onFechar={() => { setSelecionado(null); setEditarInicial(false); }} onSalvo={() => { setSelecionado(null); setEditarInicial(false); carregar(); }} />}
    </div>
  );
}

function Oficinas() {
  const [lista, setLista] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [movimentos, setMovimentos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [novo, setNovo] = useState(false);
  const [selecionado, setSelecionado] = useState(null);

  const carregar = useCallback(async () => {
    const [of, pe, mo] = await Promise.all([
      supabase.from("oficinas").select("*").order("nome_empresa"),
      supabase.from("pedidos").select("id, oficina_id"),
      supabase.from("movimentos").select("pedido_id, de_local, para_local, qtd"),
    ]);
    setLista(of.data || []); setPedidos(pe.data || []); setMovimentos(mo.data || []);
    setCarregando(false);
  }, []);

  function pecasNaOficina(oficinaId) {
    const ids = pedidos.filter((p) => p.oficina_id === oficinaId).map((p) => p.id);
    let total = 0;
    movimentos.forEach((m) => {
      if (!ids.includes(m.pedido_id)) return;
      if (m.para_local === "Oficina") total += m.qtd;
      if (m.de_local === "Oficina") total -= m.qtd;
    });
    return total;
  }
  useEffect(() => { carregar(); }, [carregar]);

  async function alternar(e, o) {
    e.stopPropagation();
    await supabase.from("oficinas").update({ ativo: !o.ativo }).eq("id", o.id);
    carregar();
  }

  if (carregando) return <p style={txtVazio}>Carregando…</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button onClick={() => setNovo(true)} style={btnPrimary}><Plus size={16} /> Nova oficina</button>
      </div>
      {lista.length === 0 ? <p style={txtVazio}>Nenhuma oficina cadastrada.</p> : (
        <div style={tabela}>
          <div style={{ ...linha, ...cabecalho }}>
            <span style={{ flex: 2 }}>Empresa</span>
            <span style={{ flex: 1 }}>Cidade</span>
            <span style={{ flex: 1 }}>Telefone</span>
            <span style={{ flex: 1 }}>Pessoas</span>
            <span style={{ flex: 1 }}>Status</span>
            <span style={{ width: 210, textAlign: "right" }}></span>
          </div>
          {lista.map((o) => (
            <div key={o.id} onClick={() => setSelecionado(o)} style={{ ...linha, cursor: "pointer" }}>
              <span style={{ flex: 2, fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
                {o.nome_empresa}
                {o.ativo && (pecasNaOficina(o.id) > 0
                  ? <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 99, background: "var(--success-bg)", color: "var(--success)" }}>{pecasNaOficina(o.id)} em produção</span>
                  : <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 99, background: "var(--danger-bg)", color: "var(--danger)" }}>Sem produção</span>)}
              </span>
              <span style={{ flex: 1, color: "var(--text-2)" }}>{o.cidade || "—"}</span>
              <span style={{ flex: 1, color: "var(--text-2)" }}>{o.telefone || "—"}</span>
              <span style={{ flex: 1, color: "var(--text-2)" }}>{o.qtd_pessoas ?? "—"}</span>
              <span style={{ flex: 1 }}><Badge ativo={o.ativo} /></span>
              <span style={{ width: 150, display: "flex", justifyContent: "flex-end", gap: 6 }}>
                <button onClick={(e) => { e.stopPropagation(); setSelecionado(o); }} style={btnIcon} aria-label="Ver detalhes"><Eye size={15} /></button>
                <button onClick={(e) => alternar(e, o)} style={btnMini}>{o.ativo ? "Desativar" : "Ativar"}</button>
              </span>
            </div>
          ))}
        </div>
      )}
      {novo && <DetalheOficina registro={null} onFechar={() => setNovo(false)} onSalvo={() => { setNovo(false); carregar(); }} />}
      {selecionado && <DetalheOficina registro={selecionado} onFechar={() => setSelecionado(null)} onSalvo={() => { setSelecionado(null); carregar(); }} />}
    </div>
  );
}

function DetalheCliente({ registro, editarInicial, onFechar, onSalvo }) {
  const novo = !registro;
  const [editando, setEditando] = useState(novo || editarInicial);
  const [nome, setNome] = useState(registro?.nome || "");
  const [contato, setContato] = useState(registro?.contato || "");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [login, setLogin] = useState(null);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (novo) return;
    supabase.from("perfis").select("email").eq("cliente_id", registro.id).eq("papel", "cliente").maybeSingle()
      .then(({ data }) => setLogin(data && data.email ? data.email : null));
  }, [novo, registro]);

  async function salvar() {
    setErro(null);
    if (!nome.trim()) return setErro("Informe o nome do cliente.");
    const querLogin = !login && (email.trim() || senha);
    if (querLogin) {
      if (!email.includes("@")) return setErro("E-mail de login inválido.");
      if (senha.length < 6) return setErro("A senha do login precisa ter ao menos 6 caracteres.");
    }
    setSalvando(true);
    const dados = { nome: nome.trim(), contato: contato.trim() || null };

    let clienteId;
    if (novo) {
      const ins = await supabase.from("clientes").insert(dados).select().single();
      if (ins.error) { setSalvando(false); return setErro(ins.error.message); }
      clienteId = ins.data.id;
    } else {
      const upd = await supabase.from("clientes").update(dados).eq("id", registro.id);
      if (upd.error) { setSalvando(false); return setErro(upd.error.message); }
      clienteId = registro.id;
    }

    if (querLogin) {
      try {
        const temp = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data, error } = await temp.auth.signUp({ email: email.trim(), password: senha, options: { data: { nome: nome.trim() } } });
        if (error) throw error;
        const id = data.user && data.user.id;
        if (!id) throw new Error("Login não criado.");
        const { error: e2 } = await supabase.from("perfis").update({ papel: "cliente", cliente_id: clienteId, nome: nome.trim(), email: email.trim() }).eq("id", id);
        if (e2) throw e2;
      } catch (e) {
        setSalvando(false);
        return setErro("Cliente salvo, mas o login falhou: " + (e.message || "") + ".");
      }
    }
    setSalvando(false);
    onSalvo();
  }

  return (
    <Overlay onFechar={onFechar}>
      <div style={headerModal}>
        <h3 style={tituloModal}>{novo ? "Novo cliente" : registro.nome}</h3>
        {!novo && !editando && <button onClick={() => setEditando(true)} style={btnMini}><Pencil size={13} /> Editar</button>}
      </div>

      {editando ? (
        <>
          <label style={lbl}>Nome</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus style={inp} />
          <label style={{ ...lbl, marginTop: 14 }}>Contato</label>
          <input value={contato} onChange={(e) => setContato(e.target.value)} placeholder="telefone, e-mail, responsável…" style={inp} />
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 8 }}>Acesso ao portal</div>
            {login ? (
              <div style={{ fontSize: 13, color: "var(--text-2)" }}>Login: <strong style={{ color: "var(--text)" }}>{login}</strong> · já criado</div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1 }}><label style={lbl}>E-mail (login)</label><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@email.com" style={inp} /></div>
                  <div style={{ flex: 1 }}><label style={lbl}>Senha</label><input value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="mín. 6 caracteres" style={inp} /></div>
                </div>
                <p style={{ fontSize: 11, color: "var(--text-3)", margin: "6px 0 0" }}>Deixe em branco se o cliente não vai acessar o portal.</p>
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Campo rotulo="Contato" valor={registro.contato} />
            <Campo rotulo="Status" valor={registro.ativo ? "Ativo" : "Inativo"} />
          </div>
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 4 }}>Acesso ao portal</div>
            {login
              ? <div style={{ fontSize: 14, color: "var(--text)" }}>{login}</div>
              : <div style={{ fontSize: 13, color: "var(--text-3)" }}>Sem acesso ainda. Clique em "Editar" para criar o login.</div>}
          </div>
        </>
      )}

      {erro && <p style={erroTxt}>{erro}</p>}

      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        {editando ? (
          <>
            <button onClick={novo ? onFechar : () => setEditando(false)} style={{ ...btnGhost, flex: 1 }}>Cancelar</button>
            <button onClick={salvar} disabled={salvando} style={{ ...btnPrimary, flex: 1 }}>{salvando ? "Salvando…" : "Salvar"}</button>
          </>
        ) : (
          <button onClick={onFechar} style={{ ...btnGhost, flex: 1 }}>Fechar</button>
        )}
      </div>
    </Overlay>
  );
}

function DetalheOficina({ registro, onFechar, onSalvo }) {
  const novo = !registro;
  const [editando, setEditando] = useState(novo);
  const [campos, setCampos] = useState({
    nome_empresa: registro?.nome_empresa || "",
    endereco: registro?.endereco || "",
    cidade: registro?.cidade || "",
    telefone: registro?.telefone || "",
    documento: registro?.documento || "",
    maquinario: registro?.maquinario || "",
    produtos: registro?.produtos || "",
    qtd_pessoas: registro?.qtd_pessoas != null ? String(registro.qtd_pessoas) : "",
  });
  const set = (k) => (e) => setCampos((c) => ({ ...c, [k]: e.target.value }));
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro(null);
    if (!campos.nome_empresa.trim()) return setErro("Informe o nome da empresa.");
    setSalvando(true);
    const dados = {
      nome_empresa: campos.nome_empresa.trim(),
      endereco: campos.endereco.trim() || null,
      cidade: campos.cidade.trim() || null,
      telefone: campos.telefone.trim() || null,
      documento: campos.documento.trim() || null,
      maquinario: campos.maquinario.trim() || null,
      produtos: campos.produtos.trim() || null,
      qtd_pessoas: campos.qtd_pessoas ? parseInt(campos.qtd_pessoas, 10) : null,
    };
    const resp = novo
      ? await supabase.from("oficinas").insert(dados)
      : await supabase.from("oficinas").update(dados).eq("id", registro.id);
    setSalvando(false);
    if (resp.error) return setErro(resp.error.message);
    onSalvo();
  }

  return (
    <Overlay onFechar={onFechar}>
      <div style={headerModal}>
        <h3 style={tituloModal}>{novo ? "Nova oficina" : registro.nome_empresa}</h3>
        {!novo && !editando && <button onClick={() => setEditando(true)} style={btnMini}><Pencil size={13} /> Editar</button>}
      </div>

      {editando ? (
        <>
          <label style={lbl}>Nome da empresa</label>
          <input value={campos.nome_empresa} onChange={set("nome_empresa")} autoFocus style={inp} />
          <label style={{ ...lbl, marginTop: 14 }}>Endereço</label>
          <input value={campos.endereco} onChange={set("endereco")} placeholder="rua, número, bairro…" style={inp} />
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <div style={{ flex: 1 }}><label style={lbl}>Cidade</label><input value={campos.cidade} onChange={set("cidade")} style={inp} /></div>
            <div style={{ flex: 1 }}><label style={lbl}>Telefone</label><input value={campos.telefone} onChange={set("telefone")} style={inp} /></div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <div style={{ flex: 1 }}><label style={lbl}>Documento (CNPJ/CPF)</label><input value={campos.documento} onChange={set("documento")} style={inp} /></div>
            <div style={{ flex: 1 }}><label style={lbl}>Qtd. de pessoas</label><input type="number" min="0" value={campos.qtd_pessoas} onChange={set("qtd_pessoas")} style={inp} /></div>
          </div>
          <label style={{ ...lbl, marginTop: 14 }}>Maquinário</label>
          <input value={campos.maquinario} onChange={set("maquinario")} placeholder="ex: 5 retas, 2 overlocks…" style={inp} />
          <label style={{ ...lbl, marginTop: 14 }}>Produtos</label>
          <input value={campos.produtos} onChange={set("produtos")} placeholder="o que a oficina produz…" style={inp} />
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 24 }}>
            <Campo rotulo="Cidade" valor={registro.cidade} />
            <Campo rotulo="Telefone" valor={registro.telefone} />
          </div>
          <Campo rotulo="Endereço" valor={registro.endereco} />
          <div style={{ display: "flex", gap: 24 }}>
            <Campo rotulo="Documento" valor={registro.documento} />
            <Campo rotulo="Qtd. de pessoas" valor={registro.qtd_pessoas != null ? String(registro.qtd_pessoas) : null} />
          </div>
          <Campo rotulo="Maquinário" valor={registro.maquinario} />
          <Campo rotulo="Produtos" valor={registro.produtos} />
          <Campo rotulo="Status" valor={registro.ativo ? "Ativo" : "Inativo"} />
        </div>
      )}

      {erro && <p style={erroTxt}>{erro}</p>}

      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        {editando ? (
          <>
            <button onClick={novo ? onFechar : () => setEditando(false)} style={{ ...btnGhost, flex: 1 }}>Cancelar</button>
            <button onClick={salvar} disabled={salvando} style={{ ...btnPrimary, flex: 1 }}>{salvando ? "Salvando…" : "Salvar"}</button>
          </>
        ) : (
          <button onClick={onFechar} style={{ ...btnGhost, flex: 1 }}>Fechar</button>
        )}
      </div>
    </Overlay>
  );
}

function AcessoPortal({ cliente, onCriado }) {
  const [abrir, setAbrir] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(null);
  const [criando, setCriando] = useState(false);

  async function criar() {
    setErro(null);
    if (!email.trim() || !email.includes("@")) return setErro("Informe um e-mail válido.");
    if (senha.length < 6) return setErro("A senha precisa ter ao menos 6 caracteres.");
    setCriando(true);
    try {
      const temp = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await temp.auth.signUp({ email: email.trim(), password: senha, options: { data: { nome: cliente.nome } } });
      if (error) throw error;
      const id = data.user && data.user.id;
      if (!id) throw new Error("Não foi possível criar o login.");
      const { error: e2 } = await supabase.from("perfis").update({ papel: "cliente", cliente_id: cliente.id, nome: cliente.nome, email: email.trim() }).eq("id", id);
      if (e2) throw e2;
      onCriado(email.trim());
    } catch (e) {
      setErro(e.message || "Erro ao criar login.");
    }
    setCriando(false);
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 8 }}>Acesso ao portal</div>
      {!abrir ? (
        <button onClick={() => setAbrir(true)} style={btnMini}>Criar login de acesso</button>
      ) : (
        <>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><label style={lbl}>E-mail (login)</label><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@email.com" style={inp} /></div>
            <div style={{ flex: 1 }}><label style={lbl}>Senha</label><input value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="mín. 6 caracteres" style={inp} /></div>
          </div>
          {erro && <p style={erroTxt}>{erro}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={() => setAbrir(false)} style={btnMini}>Cancelar</button>
            <button onClick={criar} disabled={criando} style={btnPrimary}>{criando ? "Criando…" : "Criar login"}</button>
          </div>
        </>
      )}
    </div>
  );
}

function Campo({ rotulo, valor }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 2 }}>{rotulo}</div>
      <div style={{ fontSize: 14, color: "var(--text)" }}>{valor || "—"}</div>
    </div>
  );
}

function Badge({ ativo }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
      background: ativo ? "var(--success-bg)" : "var(--surface-3)",
      color: ativo ? "var(--success)" : "var(--text-3)",
    }}>{ativo ? "Ativo" : "Inativo"}</span>
  );
}

function Overlay({ children, onFechar }) {
  return (
    <div onClick={onFechar} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 22 }}>
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
const tabela = { border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "var(--surface)" };
const linha = { display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderBottom: "1px solid var(--border)", fontSize: 13 };
const cabecalho = { background: "var(--surface-2)", fontSize: 12, color: "var(--text-2)", fontWeight: 600, cursor: "default" };
const txtVazio = { fontSize: 13, color: "var(--text-3)", padding: "16px 2px" };
const headerModal = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12 };
const tituloModal = { fontSize: 16, fontWeight: 600, margin: 0 };
const erroTxt = { fontSize: 12, color: "var(--danger)", margin: "12px 0 0" };
const inp = { width: "100%", padding: "9px 11px", fontSize: 14, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" };
const lbl = { fontSize: 12, color: "var(--text-2)", display: "block", marginBottom: 5 };
const btnPrimary = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 14px", fontSize: 13, fontWeight: 600, borderRadius: 9, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" };
const btnGhost = { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "9px 14px", fontSize: 13, fontWeight: 600, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer" };
const btnMini = { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 500, padding: "5px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer" };
const btnIcon = { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "5px 8px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer" };
const btnIconDanger = { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "5px 8px", borderRadius: 7, border: "1px solid var(--danger)", background: "var(--surface)", color: "var(--danger)", cursor: "pointer" };
