import { useEffect, useMemo, useState } from "react";
import { TextField, IconButton, Tooltip } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import coloniaService from "../services/coloniaService";

export default function RankingPanel() {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  // esperado do backend: [{ id, nomeColonia, turno, populacao, energia, comida, minerais, ciencia }]
  const [dados, setDados] = useState([]);
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState({ campo: "turno", dir: "desc" });

  // === API: busca top-10 conforme o campo (default: turno) ===
  const fetchRanking = async (campo = "turno", dir = "desc") => {
    setLoading(true);
    setErro(null);
    try {
      // Backend deve aceitar ?campo=turno&dir=desc&limit=10 (ajuste se usar nomes diferentes)
      const res = await coloniaService.getRanking({
        campo,
        dir, // normalmente "desc" p/ top maiores
        limit: 10, // top-10
      });
      const payload = Array.isArray(res) ? res : res?.data || [];
      setDados(payload);
      setOrdem({ campo, dir });
    } catch {
      setErro("Falha ao carregar ranking.");
    } finally {
      setLoading(false);
    }
  };

  // carrega inicialmente por "turno"
  useEffect(() => {
    fetchRanking("turno", "desc");
  }, []);

  // normaliza população para número total
  const popTotal = (p) => {
    if (p == null) return 0;
    if (typeof p === "number") return p;
    if (typeof p === "object") {
      return Object.values(p).reduce((acc, v) => acc + (Number(v) || 0), 0);
    }
    return Number(p) || 0;
  };

  const getCampoValor = (row, campo) => {
    switch (campo) {
      case "populacaoTotal":
        return popTotal(row.populacao);
      case "turno":
      case "energia":
      case "comida":
      case "minerais":
      case "ciencia":
        return Number(row[campo]) || 0;
      case "nomeColonia":
        return (row.nomeColonia || "").toLowerCase();
      default:
        return 0;
    }
  };

  // filtro por busca (mantém ordem recebida da API; só reordena se usuário inverter dir na mesma coluna)
  const dadosFiltrados = useMemo(() => {
    const term = busca.trim().toLowerCase();
    let base = term
      ? dados.filter((r) => (r.nomeColonia || "").toLowerCase().includes(term))
      : dados.slice();

    // Se usuário trocar apenas a direção na mesma coluna, invertimos localmente
    if (ordem.dir === "asc") {
      base = base.slice().sort((a, b) => {
        const va = getCampoValor(a, ordem.campo);
        const vb = getCampoValor(b, ordem.campo);
        if (va < vb) return -1;
        if (va > vb) return 1;
        return 0;
      });
    }
    // Se for "desc", assumimos que a API já trouxe top-10 desc.

    return base;
  }, [dados, busca, ordem]);

  // clique no cabeçalho:
  // - se mudar de coluna: chama API com novo campo (sempre desc/top-10)
  // - se clicar na mesma coluna: alterna dir (asc/desc) localmente
  const handleHeaderClick = (campo) => {
    if (ordem.campo !== campo) {
      fetchRanking(campo, "desc");
      return;
    }
    // mesma coluna: alterna direção (sem refetch; apenas ordenação local)
    setOrdem((prev) => ({ campo, dir: prev.dir === "asc" ? "desc" : "asc" }));
  };

  const Th = ({ campo, children }) => {
    const active = ordem.campo === campo;
    return (
      <th className="px-3 py-2 text-left text-slate-300">
        <button
          className={`inline-flex items-center gap-1 ${
            active ? "text-white" : ""
          }`}
          onClick={() => handleHeaderClick(campo)}
        >
          {children}
          {active ? (
            ordem.dir === "asc" ? (
              <ArrowUpwardIcon fontSize="inherit" />
            ) : (
              <ArrowDownwardIcon fontSize="inherit" />
            )
          ) : null}
        </button>
      </th>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 text-slate-800">
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-2xl font-bold">Ranking</h3>
        <Tooltip title="Atualizar">
          <IconButton
            size="small"
            onClick={() => fetchRanking(ordem.campo, "desc")}
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
        <div className="ml-auto">
          <TextField
            size="small"
            placeholder="Buscar colônia..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </div>

      {erro && <div className="mb-3 text-red-600 text-sm">{erro}</div>}
      {loading ? (
        <div className="text-slate-500">Carregando...</div>
      ) : (
        <div className="overflow-auto rounded-lg border border-slate-200">
          <table className="min-w-full bg-slate-900 text-slate-200">
            <thead className="bg-slate-800">
              <tr>
                <Th campo="posicao">#</Th>
                <Th campo="nomeColonia">Colônia</Th>
                <Th campo="turno">Turno</Th>
                <Th campo="populacaoTotal">População</Th>
                <Th campo="energia">Energia</Th>
                <Th campo="comida">Comida</Th>
                <Th campo="minerais">Minerais</Th>
                <Th campo="ciencia">Ciência</Th>
              </tr>
            </thead>
            <tbody>
              {dadosFiltrados.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-6 text-center text-slate-400"
                  >
                    Sem resultados.
                  </td>
                </tr>
              ) : (
                dadosFiltrados.map((row, i) => (
                  <tr
                    key={row.id || row.nomeColonia || i}
                    className="odd:bg-slate-900 even:bg-slate-950"
                  >
                    <td className="px-3 py-2">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{row.nomeColonia}</td>
                    <td className="px-3 py-2">{Number(row.turno) || 0}</td>
                    <td className="px-3 py-2">{popTotal(row.populacao)}</td>
                    <td className="px-3 py-2">{Number(row.energia) || 0}</td>
                    <td className="px-3 py-2">{Number(row.comida) || 0}</td>
                    <td className="px-3 py-2">{Number(row.minerais) || 0}</td>
                    <td className="px-3 py-2">{Number(row.ciencia) || 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 text-xs text-slate-500">
        Dica: clique nos cabeçalhos para ordenar.
      </div>
    </div>
  );
}
