// Configuración de Supabase
const SUPABASE_URL = "https://wyornkwbqgboopjoevtu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5b3Jua3dicWdib29wam9ldnR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MzI3NDUsImV4cCI6MjA4MDIwODc0NX0.xFg6gJbPsO9b-iHOn2dhxXnyTSJIDhVveoJRu2xpWI8";

// Inicializar Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
