// Auvii — Supabase client config
// Loaded by auth.html, account.html, and index.html via <script src="sb-config.js">
const SUPABASE_URL = "https://aqxdmlyvmjmkdnqkwgot.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxeGRtbHl2bWpta2RucWt3Z290Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzNTkzODIsImV4cCI6MjEwMzkzNTM4Mn0.gNsY7NbIWhSfvvxohZQWAtJNXf_61-UluSfCjanX780";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
