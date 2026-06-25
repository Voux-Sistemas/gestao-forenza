import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";
import { Layers, LogOut, Moon, Sun, LayoutGrid, Users, AlertTriangle, Package, Inbox } from "lucide-react";
import Quadro from "./Quadro.jsx";
import Cadastros from "./Cadastros.jsx";
import Atrasos from "./Atrasos.jsx";
import Estoque from "./Estoque.jsx";
import Triagem from "./Triagem.jsx";

const PAPEL_LABEL = {
  funcionario: "Funcionário", chefe_setor: "Chefe de setor",
  chefe_geral: "Chefe geral", master: "Master", cliente: "Cliente",
};
const iconBtn = { border: "1px solid var(--border)", borderRadius: 8, padding: 8, color: "var(--text-2)", background: "none", display: "inline-flex" };

export default function Shell({ session }) {
  const [perfil, setPerfil] = useState(null);
  const [tema, setTema] = useState("light");
  const [pagina, setPagina] = useState("quadro");

  useEffect(() => {
    supabase.from("perfis").select("nome, papel, setor").eq("id", session.user.id).single()
      .then(({ data, error }) => { if (!error) setPerfil(data); });
  }, [session]);

  useEffect(() => { document.documentElement.setAttribute("data-theme", tema); }, [tema]);

  const subtitulo = perfil ? [PAPEL_LABEL[perfil.papel], perfil.setor].filter(Boolean).join(" · ") : "carregando…";
  const podeAdministrar = ["master", "chefe_geral"].includes(perfil?.papel);

  const navItens = [
    { id: "quadro", label: "Quadro", icon: LayoutGrid },
    { id: "triagem", label: "Triagem", icon: Inbox },
    { id: "estoque", label: "Estoque", icon: Package },
    { id: "atrasos", label: "Atrasos", icon: AlertTriangle },
    { id: "cadastros", label: "Cadastros", icon: Users },
  ];

  function conteudo() {
    if (!perfil) return <div style={{ padding: 28, color: "var(--text-2)" }}>Carregando…</div>;
    if (pagina === "cadastros" && podeAdministrar) return <Cadastros />;
    if (pagina === "atrasos" && podeAdministrar) return <Atrasos />;
    if (pagina === "estoque" && podeAdministrar) return <Estoque session={session} />;
    if (pagina === "triagem" && podeAdministrar) return <Triagem />;
    return <Quadro session={session} perfil={perfil} />;
  }

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

      {podeAdministrar && (
        <nav style={{ display: "flex", gap: 4, padding: "0 22px", borderBottom: "1px solid var(--border)", background: "var(--surface)", overflowX: "auto" }}>
          {navItens.map((item) => {
            const Icone = item.icon;
            const ativo = pagina === item.id;
            return (
              <button key={item.id} onClick={() => setPagina(item.id)} style={{
                display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 14px", fontSize: 13, fontWeight: 500, whiteSpace: "nowrap",
                border: "none", background: "none", cursor: "pointer", color: ativo ? "var(--accent)" : "var(--text-2)",
                borderBottom: ativo ? "2px solid var(--accent)" : "2px solid transparent", marginBottom: -1,
              }}>
                <Icone size={15} /> {item.label}
              </button>
            );
          })}
        </nav>
      )}

      <main>{conteudo()}</main>
    </div>
  );
}
