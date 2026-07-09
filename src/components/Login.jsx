import React, { useState } from "react";
import { supabase } from "../supabaseClient.js";
import { MarcaForenza } from "./Logo.jsx";

const inputStyle = {
  width: "100%", padding: "10px 12px 10px 38px", fontSize: 14, borderRadius: 9,
  border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)",
  boxSizing: "border-box",
};

function IconUser() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function IconMail() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 5L2 7" />
    </svg>
  );
}
function IconLock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
function IconEye({ aberto }) {
  return aberto ? (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

export default function Login({ modoClienteInicial }) {
  const [aba, setAba] = useState(modoClienteInicial ? "cliente" : "funcionario");
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [focado, setFocado] = useState(null);

  const ehCliente = aba === "cliente";

  async function entrar(e) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const email = ehCliente
      ? usuario.trim()
      : (usuario.includes("@") ? usuario.trim() : `${usuario.trim()}@admin.com`);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) {
      setCarregando(false);
      setErro(ehCliente ? "E-mail ou senha incorretos." : "Usuário ou senha incorretos.");
      return;
    }
    // Confere se o papel do usuário corresponde à aba escolhida.
    const uid = data.user?.id;
    if (uid) {
      const { data: perfil } = await supabase.from("perfis").select("papel").eq("id", uid).single();
      const papel = perfil?.papel;
      if (ehCliente && papel !== "cliente") {
        await supabase.auth.signOut();
        setCarregando(false);
        setErro("Este login é de funcionário. Use a aba \"Funcionário\".");
        return;
      }
      if (!ehCliente && papel === "cliente") {
        await supabase.auth.signOut();
        setCarregando(false);
        setErro("Este login é de cliente. Use a aba \"Cliente\".");
        return;
      }
    }
    setCarregando(false);
  }

  function trocarAba(id) {
    setAba(id);
    setErro(null);
    setUsuario("");
    setSenha("");
  }

  const corIcone = (id) => focado === id ? "var(--accent)" : "var(--text-3)";

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      position: "relative", overflow: "hidden",
      backgroundImage: "url(/fabrica-login.jpg)",
      backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat",
    }}>
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(135deg, rgba(27,58,20,0.45) 0%, rgba(42,92,32,0.32) 50%, rgba(60,143,46,0.28) 100%)",
        pointerEvents: "none",
      }} />

      <form onSubmit={entrar} className="pop" style={{
        position: "relative",
        width: "100%", maxWidth: 380,
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18,
        padding: "30px 30px 28px",
        boxShadow: "0 24px 60px rgba(0,0,0,0.30), 0 8px 22px rgba(0,0,0,0.18)",
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginBottom: 24 }}>
          <MarcaForenza size={58} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "2px" }}>FORENZA<sup style={{ fontSize: ".5em", fontWeight: 700, verticalAlign: "super", color: "var(--text-3)" }}>®</sup></div>
            <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>Entre para acessar a gestão de produção</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 4, padding: 3, background: "var(--surface-2)", borderRadius: 10, marginBottom: 18 }}>
          {[["funcionario", "Funcionário"], ["cliente", "Cliente"]].map(([id, label]) => (
            <button key={id} type="button" onClick={() => trocarAba(id)} style={{
              flex: 1, padding: "8px 0", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "none", cursor: "pointer",
              background: aba === id ? "var(--surface)" : "transparent",
              color: aba === id ? "var(--accent)" : "var(--text-2)",
              boxShadow: aba === id ? "0 1px 2px rgba(0,0,0,.08)" : "none",
            }}>{label}</button>
          ))}
        </div>

        <label style={{ fontSize: 12, color: "var(--text-2)", display: "block", marginBottom: 5 }}>{ehCliente ? "E-mail" : "Usuário"}</label>
        <div style={{ position: "relative" }}>
          <span style={{
            position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
            color: corIcone("user"), display: "flex", alignItems: "center",
            pointerEvents: "none", transition: "color .15s",
          }}>
            {ehCliente ? <IconMail /> : <IconUser />}
          </span>
          <input
            type={ehCliente ? "email" : "text"}
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            onFocus={() => setFocado("user")}
            onBlur={() => setFocado(null)}
            required autoFocus
            placeholder={ehCliente ? "Digite seu e-mail" : "Digite seu usuário"}
            style={inputStyle}
          />
        </div>

        <label style={{ fontSize: 12, color: "var(--text-2)", display: "block", margin: "14px 0 5px" }}>Senha</label>
        <div style={{ position: "relative" }}>
          <span style={{
            position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
            color: corIcone("senha"), display: "flex", alignItems: "center",
            pointerEvents: "none", transition: "color .15s",
          }}>
            <IconLock />
          </span>
          <input
            type={verSenha ? "text" : "password"}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            onFocus={() => setFocado("senha")}
            onBlur={() => setFocado(null)}
            required
            placeholder="Digite sua senha"
            style={{ ...inputStyle, paddingRight: 38 }}
          />
          <button
            type="button"
            onClick={() => setVerSenha((v) => !v)}
            aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
            style={{
              position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
              background: "transparent", border: "none", padding: 8, cursor: "pointer",
              color: "var(--text-3)", display: "flex", alignItems: "center",
            }}
          >
            <IconEye aberto={verSenha} />
          </button>
        </div>

        {erro && <p style={{ fontSize: 12, color: "var(--danger)", margin: "12px 0 0" }}>{erro}</p>}

        <button type="submit" disabled={carregando}
          style={{ width: "100%", marginTop: 22, padding: "12px", fontSize: 14, fontWeight: 700, borderRadius: 10, border: "none", background: "linear-gradient(135deg,var(--accent),var(--accent-2))", color: "#fff", boxShadow: "var(--shadow-md)", opacity: carregando ? 0.7 : 1 }}>
          {carregando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
