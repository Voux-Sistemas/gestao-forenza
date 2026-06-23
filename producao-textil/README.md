# Produção Têxtil — Frontend

App em React (Vite) que conversa com o banco no Supabase.
Parte 1: projeto + conexão + login funcionando.

## 1. Cole as chaves do Supabase

Abra o arquivo `src/config.js` e cole os dois dados do seu projeto
(no Supabase: Project Settings > API):

- **Project URL**  ->  `SUPABASE_URL`
- **anon public** (em Project API keys)  ->  `SUPABASE_ANON_KEY`

Pode subir pro GitHub sem medo: a chave anon é pública por natureza;
quem protege os dados é o RLS do banco.

## 2a. Publicar no Netlify (sem usar seu computador)

1. Suba esta pasta para um repositório no GitHub.
2. No Netlify: "Add new site" > "Import an existing project" > escolha o repositório.
3. O arquivo `netlify.toml` já define o build. É só confirmar e publicar.
4. O Netlify te dá um endereço `algo.netlify.app`.

## 2b. Rodar no seu computador (opcional)

Com Node 18+ instalado, dentro da pasta:

\`\`\`
npm install
npm run dev
\`\`\`

Abra http://localhost:5173.

## Entrar

Usuários de teste (senha \`senha123\`): \`corte@fabrica.test\`,
\`chefegeral@fabrica.test\`, \`cliente.lima@fabrica.test\`, entre outros.
Depois de entrar, a tela mostra quem você é e qual o seu papel — esse dado
vem do banco, já passando pelas regras de acesso.
