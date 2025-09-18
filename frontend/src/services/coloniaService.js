// src/services/coloniaService.js
import axios from "axios";

//const API_URL = "http://localhost:5000/colonia"; // ajuste se for deploy

const BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/colonia"
).replace(/\/+$/, ""); // remove barra final

const axios = axios.create({ baseURL: BASE });

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
    const { data } = await axios.post("/");
    return data;
  },
  buscarColonia: async (nome) =>
    (await axios.get(`${API_URL}/buscar/${nome}`)).data,
  atualizarColonia: async (id, dados) =>
    (await axios.put(`${API_URL}/${id}`, dados)).data,
  getEstado: async (id) => (await axios.get(`${API_URL}/${id}/estado`)).data,
  gastarAgua: async (id, cost) =>
    (await axios.post(`${API_URL}/${id}/gastar-agua`, { cost })).data,
};

export default coloniaService;
