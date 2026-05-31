const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://tywwfnuanuvoaxhzeqte.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5d3dmbnVhbnV2b2F4aHplcXRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNjIxODEsImV4cCI6MjA5NDgzODE4MX0.c1F1WZlQRkYEroDFTtQu9YirrMGGC6fhAIGQXOMtK3w";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDb() {
  const { data: articles, error: errArticles } = await supabase.from('articles').select('*').limit(1);
  console.log("Articles:", articles ? Object.keys(articles[0] || {}) : null, errArticles);

  const { data: categories, error: errCategories } = await supabase.from('categories').select('*').limit(1);
  console.log("Categories:", categories ? Object.keys(categories[0] || {}) : null, errCategories);

  const { data: settings, error: errSettings } = await supabase.from('settings').select('*').limit(1);
  console.log("Settings:", settings ? Object.keys(settings[0] || {}) : null, errSettings);
}

checkDb();
