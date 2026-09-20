import axios from "axios";

const apiBaseUrl =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const API = axios.create({
<<<<<<< HEAD
  baseURL: "http://localhost:5000/api",
=======
  baseURL: apiBaseUrl,
>>>>>>> 88ddb7bcec37e901e6d39b92c93250f2df17a3fb
});

export default API;
