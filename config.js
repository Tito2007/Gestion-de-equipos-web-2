// Configuración de Supabase
const SUPABASE_URL = 'https://wyornkwbqgboopjoevtu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5b3Jua3dicWdib29wam9ldnR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDYzMjc0NSwiZXhwIjoyMDgwMjA4NzQ1fQ.lpQdtdr01aNgyYm__aIvyjanOKRSHplFthleu2wz36M';

// Inicializar Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
