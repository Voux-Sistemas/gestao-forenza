import React, { useState } from "react";
import { supabase } from "../supabaseClient.js";
import { Layers } from "lucide-react";

const inputStyle = {
  width: "100%", padding: "10px 12px", fontSize: 14, borderRadius: 9,
  border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)",
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) setErro("E-mail ou senha incorretos.");
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <form onSubmit={entrar} style={{ width: "100%", maxWidth: 360, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
          <Layers size={22} style={{ color: "var(--accent)" }} />
          <span style={{ fontSize: 19, fontWeight: 600 }}>Produção</span>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 22px" }}>Entre com seu e-mail e senha</p>

        <label style={{ fontSize: 12, color: "var(--text-2)", display: "block", marginBottom: 5 }}>E-mail</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />

        <label style={{ fontSize: 12, color: "var(--text-2)", display: "block", margin: "14px 0 5px" }}>Senha</label>
        <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required style={inputStyle} />

        {erro && <p style={{ fontSize: 12, color: "var(--danger)", margin: "12px 0 0" }}>{erro}</p>}

        <button type="submit" disabled={carregando}
          style={{ width: "100%", marginTop: 22, padding: "11px", fontSize: 14, fontWeight: 600, borderRadius: 9, border: "none", background: "var(--accent)", color: "#fff" }}>
          {carregando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
