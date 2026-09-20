import axios from "axios";

const apiBaseUrl =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const API = axios.create({
  baseURL: apiBaseUrl,
});

export default API;