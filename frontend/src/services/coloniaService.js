// src/services/coloniaService.js
import axios from "axios";

//const API_URL = "http://localhost:5000/colonia"; // ajuste se for deploy

const BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/colonia"
).replace(/\/+$/, ""); // remove barra final

const api = axios.create({ baseURL: BASE });

const coloniaService = {
  criarColonia: async (payload) => {
    const body =
      typeof payload === "string"
        ? { nome: payload }
        : {
            usuario: payload.usuario?.trim(),
            senha: payload.senha,
            nome: payload.nome?.trim(),
            landingSite: payload.landingSite,
            doutrina: payload.doutrina,
          };
    const { data } = await api.post("/");
    return data;
  },

  buscarColonia: async (nome) => (await api.get(`/buscar/${nome}`)).data,
  atualizarColonia: async (id, dados) => (await api.put(`/${id}`, dados)).data,
  getEstado: async (id) => (await api.get(`/${id}/estado`)).data,
  gastarAgua: async (id, cost) =>
    (await api.post(`/${id}/gastar-agua`, { cost })).data,
};

export default coloniaService;
