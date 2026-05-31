const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://tywwfnuanuvoaxhzeqte.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5d3dmbnVhbnV2b2F4aHplcXRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNjIxODEsImV4cCI6MjA5NDgzODE4MX0.c1F1WZlQRkYEroDFTtQu9YirrMGGC6fhAIGQXOMtK3w";

const supabase = createClient(supabaseUrl, supabaseKey);

async function listFiles() {
  console.log("Listing files in root:");
  const { data: rootData, error: rootError } = await supabase.storage
    .from('product-images')
    .list('', { limit: 100 });
  
  if (rootError) console.error("Root error:", rootError);
  else console.log("Root files:", rootData);

  console.log("Listing files in 'logos':");
  const { data: logosData, error: logosError } = await supabase.storage
    .from('product-images')
    .list('logos', { limit: 100 });
  
  if (logosError) console.error("Logos error:", logosError);
  else console.log("Logos files:", logosData);
}

listFiles();
