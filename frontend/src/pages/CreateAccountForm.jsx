// src/pages/CreateAccountForm.js
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import coloniaService from "../services/coloniaService";

const LANDING_OPTS = [
  {
    id: "vale_nebuloso",
    nome: "Vale Nebuloso",
    desc: "+20% agricultura; −10% energia",
    bonus: { agricultura: +20, energia: -10 },
  },
  {
    id: "escarpa_basalto",
    nome: "Escarpa de Basalto",
    desc: "+20% mineração; −10% agricultura",
    bonus: { mineracao: +20, agricultura: -10 },
  },
  {
    id: "planicie_vento_frio",
    nome: "Planície Vento-Frio",
    desc: "+15% energia; −5% ambos",
    bonus: { energia: +15, agricultura: -5, mineracao: -5 },
  },
];

const DOCTRINE_OPTS = [
  { id: "agronomia", nome: "Agronomia", start: "1 Fazenda" },
  { id: "saude", nome: "Saúde", start: "1 Posto Médico" },
  { id: "mineracao", nome: "Mineração", start: "1 Mina de Carvão" },
  { id: "energia", nome: "Energia", start: "1 Gerador Solar" },
];

export default function CreateAccountForm({ setEstadoAtual }) {
  const navigate = useNavigate();

  // campos
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [nomeColonia, setNomeColonia] = useState("");
  const [landing, setLanding] = useState(LANDING_OPTS[0].id);
  const [doutrina, setDoutrina] = useState(DOCTRINE_OPTS[0].id);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const landingSel = useMemo(
    () => LANDING_OPTS.find((o) => o.id === landing),
    [landing]
  );
  const doutrinaSel = useMemo(
    () => DOCTRINE_OPTS.find((o) => o.id === doutrina),
    [doutrina]
  );

  const validar = () => {
    if (!usuario.trim()) return "Informe o nome de usuário.";
    if (senha.length < 6) return "A senha deve ter ao menos 6 caracteres.";
    if (!nomeColonia.trim()) return "Informe o nome da colônia.";
    return "";
  };

  const handleCreate = async () => {
    const msg = validar();
    if (msg) {
      setErro(msg);
      return;
    }
    setErro("");
    try {
      setLoading(true);

      // payload para o backend
      const payload = {
        usuario: usuario.trim(),
        senha,
        nome: nomeColonia.trim(),
        landingSite: landing, // "vale_nebuloso" | "escarpa_basalto" | "planicie_vento_frio"
        doutrina, // "agronomia" | "saude" | "mineracao" | "energia"
      };

      const novaColonia = await coloniaService.criarColonia(payload);

      // guarda para o fluxo que busca por nome depois
      localStorage.setItem("nomeColonia", novaColonia.nome);
      localStorage.setItem("coloniaId", novaColonia._id);
      localStorage.setItem("usuario", payload.usuario);

      setEstadoAtual(novaColonia);
      navigate("/intro", { state: { coloniaId: novaColonia._id } });
      console.log("Colônia criada:", novaColonia);
    } catch (err) {
      console.error(err);
      setErro(err?.response?.data?.erro || "Erro ao criar conta/colônia.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h2 className="text-lg font-semibold mb-4">Criar Conta</h2>

      {erro && (
        <div className="bg-red-700/30 border border-red-600 text-red-200 text-sm p-2 rounded mb-3">
          {erro}
        </div>
      )}

      {/* Usuário */}
      <label className="block text-sm mb-1">Nome do Usuário</label>
      <input
        type="text"
        placeholder="ex.: comandante_aurora"
        value={usuario}
        onChange={(e) => setUsuario(e.target.value)}
        className="w-full p-2 rounded bg-gray-700 mb-3 text-white"
        disabled={loading}
      />

      {/* Senha */}
      <label className="block text-sm mb-1">Senha</label>
      <input
        type="password"
        placeholder="mín. 6 caracteres"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        className="w-full p-2 rounded bg-gray-700 mb-3 text-white"
        disabled={loading}
      />

      {/* Nome da Colônia */}
      <label className="block text-sm mb-1">Nome da Colônia</label>
      <input
        type="text"
        placeholder="ex.: Gênesis Prime"
        value={nomeColonia}
        onChange={(e) => setNomeColonia(e.target.value)}
        className="w-full p-2 rounded bg-gray-700 mb-4 text-white"
        disabled={loading}
      />

      {/* Local de pouso */}
      <div className="mb-4">
        <div className="text-sm font-medium mb-2">Local de Pouso</div>
        <div className="space-y-2">
          {LANDING_OPTS.map((opt) => (
            <label
              key={opt.id}
              className={`flex items-start gap-3 p-3 rounded cursor-pointer border ${
                landing === opt.id
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-gray-600 bg-gray-700/40"
              }`}
            >
              <input
                type="radio"
                name="landing"
                value={opt.id}
                checked={landing === opt.id}
                onChange={() => setLanding(opt.id)}
                disabled={loading}
                className="mt-1"
              />
              <div>
                <div className="font-semibold">{opt.nome}</div>
                <div className="text-xs opacity-90">{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Doutrina inicial */}
      <div className="mb-5">
        <div className="text-sm font-medium mb-2">Doutrina Inicial</div>
        <div className="grid grid-cols-1 gap-2">
          {DOCTRINE_OPTS.map((opt) => (
            <label
              key={opt.id}
              className={`flex items-start gap-3 p-3 rounded cursor-pointer border ${
                doutrina === opt.id
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-gray-600 bg-gray-700/40"
              }`}
            >
              <input
                type="radio"
                name="doutrina"
                value={opt.id}
                checked={doutrina === opt.id}
                onChange={() => setDoutrina(opt.id)}
                disabled={loading}
                className="mt-1"
              />
              <div>
                <div className="font-semibold">{opt.nome}</div>
                <div className="text-xs opacity-90">Início: {opt.start}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Resumo do início */}
      <div className="bg-gray-800/70 rounded p-3 text-sm border border-gray-700 mb-4">
        <div className="font-semibold mb-1">Resumo do Início</div>
        <div>
          • Local: <b>{landingSel?.nome}</b> — {landingSel?.desc}
        </div>
        <div>
          • Doutrina: <b>{doutrinaSel?.nome}</b> — {doutrinaSel?.start}
        </div>
      </div>

      <button
        onClick={handleCreate}
        className="w-full bg-green-600 hover:bg-green-700 p-2 rounded disabled:opacity-60"
        disabled={loading}
      >
        {loading ? "Criando..." : "Criar conta e iniciar colônia"}
      </button>
    </>
  );
}
