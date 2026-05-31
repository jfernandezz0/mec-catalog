const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://tywwfnuanuvoaxhzeqte.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5d3dmbnVhbnV2b2F4aHplcXRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNjIxODEsImV4cCI6MjA5NDgzODE4MX0.c1F1WZlQRkYEroDFTtQu9YirrMGGC6fhAIGQXOMtK3w";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDelete() {
  console.log("Attempting delete of logos/MEC_TEST_ANON.png...");
  const { data, error } = await supabase.storage
    .from('product-images')
    .remove(['logos/MEC_TEST_ANON.png']);

  if (error) {
    console.error("Delete error:", error);
  } else {
    console.log("Delete success:", data);
  }
}

testDelete();
