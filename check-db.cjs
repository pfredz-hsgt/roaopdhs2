const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data: sessions, error: sessionErr } = await supabase.from('indent_sessions').select('*').eq('status', 'Draft');
    console.log('Draft Sessions:', sessions?.length, sessionErr);
    if (sessions && sessions.length > 0) {
        const { data: items } = await supabase.from('indent_items').select('*').eq('session_id', sessions[0].id);
        console.log('Items in first draft session:', items, items?.length);
    } else {
        console.log('No draft sessions');
    }
}
check();
