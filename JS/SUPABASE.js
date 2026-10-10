
/* =========================================
   CAMPUS - CONEXIÓN CON SUPABASE
========================================= */

// Escribe aquí las credenciales reales de tu proyecto.
const SUPABASE_URL = "https://jlhmojfiocyyponpkttt.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_2To6Y5AD7cKcf0QNDwzmrQ_OabWRX26";

const clienteSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

console.log("CAMPUS: cliente de Supabase inicializado.");
