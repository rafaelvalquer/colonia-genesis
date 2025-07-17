// src/services/coloniaService.js
import axios from "axios";

const API_URL = "http://localhost:5000/colonia"; // ajuste se for deploy

const coloniaService = {
  criarColonia: async (nome) => {
    const response = await axios.post(`${API_URL}/criar`, { nome });
    return response.data;
  },

  buscarColonia: async (nome) => {
    const response = await axios.get(`${API_URL}/buscar/${nome}`);
    return response.data;
  },
  
  atualizarColonia: async (id, dadosAtualizados) => {
    const response = await axios.put(`${API_URL}/${id}`, dadosAtualizados);
    return response.data;
  },
};


export default coloniaService;
