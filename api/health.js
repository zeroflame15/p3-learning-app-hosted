// GET /api/health — what is configured on this deployment (no secrets).
// Also reports the under-the-hood wiring: skill pack version, specialist
// agent count (19, 17 on Meta Muse, per the myKx video), and whether
// the flag log is configured.
const { SKILL_PACK_VERSION } = require('../lib/skills');
const { AGENTS, liveAgents, readyAgents, placeholderAgents } = require('../lib/agents');

module.exports = async (req, res) => {
  res.status(200).setHeader('Content-Type', 'application/json');
  res.json({
    ok: true,
    livePip: Boolean(process.env.MODEL_API_KEY),
    model: process.env.MODEL_ID || 'muse-spark-1.3',
    progressSync: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY),
    skillPack: SKILL_PACK_VERSION,
    agents: AGENTS.length,
    liveAgents: liveAgents().length,
    readyAgents: readyAgents().length,
    placeholderAgents: placeholderAgents().map((a) => a.id).sort(),
    flagLog: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY),
  });
};
