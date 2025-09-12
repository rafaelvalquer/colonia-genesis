// src/services/coloniaService.js
import axios from "axios";

const API_URL = "http://localhost:5000/colonia"; // ajuste se for deploy

const coloniaService = {
  criarColonia: async (nome) =>
    (await axios.post(API_URL + "/", { nome })).data,
  buscarColonia: async (nome) =>
    (await axios.get(`${API_URL}/buscar/${nome}`)).data,
  atualizarColonia: async (id, dados) =>
    (await axios.put(`${API_URL}/${id}`, dados)).data,
  getEstado: async (id) => (await axios.get(`${API_URL}/${id}/estado`)).data,
  gastarAgua: async (id, cost) =>
    (await axios.post(`${API_URL}/${id}/gastar-agua`, { cost })).data,
};

export default coloniaService;
