// ==============================
// CONFIGURAÇÃO DO SUPABASE
// Carregue DEPOIS do script do supabase-js (CDN) e ANTES do script.js
// A URL é só o endereço do projeto (sem /rest/v1/).
// A chave "publishable" pode ficar no site; NUNCA coloque a service_role aqui.
// ==============================

const SUPABASE_URL = "https://hfvjtwhfzvnqdkhhmbyh.supabase.co";

const SUPABASE_ANON_KEY = "sb_publishable_iiz4_ldEhGT7EwwjE76gcA_Qy0NRmvu";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);
