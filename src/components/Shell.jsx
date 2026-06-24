import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";
import { Layers, LogOut, Moon, Sun } from "lucide-react";
import Quadro from "./Quadro.jsx";

const PAPEL_LABEL = {
  funcionario: "Funcionário", chefe_setor: "Chefe de setor",
  chefe_geral: "Chefe geral", master: "Master", cliente: "Cliente",
};
const iconBtn = { border: "1px solid var(--border)", borderRadius: 8, padding: 8, color: "var(--text-2)", background: "none", display: "inline-flex" };

export default function Shell({ session }) {
  const [perfil, setPerfil] = useState(null);
  const [tema, setTema] = useState("light");

  useEffect(() => {
    supabase.from("perfis").select("nome, papel, setor").eq("id", session.user.id).single()
      .then(({ data, error }) => { if (!error) setPerfil(data); });
  }, [session]);

  useEffect(() => { document.documentElement.setAttribute("data-theme", tema); }, [tema]);

  const subtitulo = perfil ? [PAPEL_LABEL[perfil.papel], perfil.setor].filter(Boolean).join(" · ") : "carregando…";

  return (
    <div style={{ minHeight: "100vh" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 22px", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
          <Layers size={20} style={{ color: "var(--accent)" }} />
          <span style={{ fontSize: 18, fontWeight: 600 }}>Produção</span>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{perfil?.nome || "Usuário"}</div>
            <div style={{ fontSize: 12, color: "var(--text-2)" }}>{subtitulo}</div>
          </div>
          <button onClick={() => setTema((t) => (t === "light" ? "dark" : "light"))} aria-label="Mudar tema" style={iconBtn}>
            {tema === "light" ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <button onClick={() => supabase.auth.signOut()} aria-label="Sair" style={iconBtn}><LogOut size={16} /></button>
        </div>
      </header>
      <main>
        {perfil ? <Quadro session={session} perfil={perfil} /> : <div style={{ padding: 28, color: "var(--text-2)" }}>Carregando…</div>}
      </main>
    </div>
  );
}
