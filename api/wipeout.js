const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  const providedPassword = req.headers['x-admin-password'];

  if (!providedPassword || providedPassword !== adminPassword) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Using a filter that is always true to update all rows.
  // Note: we reset stats instead of completely deleting users to prevent breaking 
  // active player sessions or game state, but this achieves the 'wipeout' of the leaderboard.
  // We reset local_wins and online_winnings to 0.
  const { data, error } = await supabase
    .from('users')
    .update({ 
      local_wins: 0, 
      online_winnings: 0
    })
    .neq('wallet_address', 'NON_EXISTENT_ADDRESS_TO_BYPASS_FILTER_REQUIREMENT'); 

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true, message: 'Database wiped out successfully.' });
};
