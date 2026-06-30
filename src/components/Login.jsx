import React, { useState } from "react";
import { supabase } from "../supabaseClient.js";
import { MarcaForenza } from "./Logo.jsx";

const inputStyle = {
  width: "100%", padding: "10px 12px", fontSize: 14, borderRadius: 9,
  border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)",
};

export default function Login({ modoClienteInicial }) {
  const [aba, setAba] = useState(modoClienteInicial ? "cliente" : "funcionario");
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(false);

  const ehCliente = aba === "cliente";

  async function entrar(e) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const email = ehCliente
      ? usuario.trim()
      : (usuario.includes("@") ? usuario.trim() : `${usuario.trim()}@admin.com`);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) setErro(ehCliente ? "E-mail ou senha incorretos." : "Usuário ou senha incorretos.");
  }

  function trocarAba(id) {
    setAba(id);
    setErro(null);
    setUsuario("");
    setSenha("");
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "radial-gradient(1100px 480px at 50% -8%, var(--accent-bg), transparent 60%)" }}>
      <form onSubmit={entrar} className="pop" style={{ width: "100%", maxWidth: 380, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: "30px 30px 28px", boxShadow: "var(--shadow-lg)" }}>
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
        <input type={ehCliente ? "email" : "text"} value={usuario} onChange={(e) => setUsuario(e.target.value)} required autoFocus
          placeholder={ehCliente ? "seu@email.com" : ""} style={inputStyle} />

        <label style={{ fontSize: 12, color: "var(--text-2)", display: "block", margin: "14px 0 5px" }}>Senha</label>
        <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required style={inputStyle} />

        {erro && <p style={{ fontSize: 12, color: "var(--danger)", margin: "12px 0 0" }}>{erro}</p>}

        <button type="submit" disabled={carregando}
          style={{ width: "100%", marginTop: 22, padding: "12px", fontSize: 14, fontWeight: 700, borderRadius: 10, border: "none", background: "linear-gradient(135deg,var(--accent),var(--accent-2))", color: "#fff", boxShadow: "var(--shadow-md)", opacity: carregando ? 0.7 : 1 }}>
          {carregando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
