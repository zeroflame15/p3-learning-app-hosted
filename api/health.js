// GET /api/health — what is configured on this deployment (no secrets).
module.exports = async (req, res) => {
  res.status(200).setHeader('Content-Type', 'application/json');
  res.json({
    ok: true,
    livePip: Boolean(process.env.MODEL_API_KEY),
    model: process.env.MODEL_ID || 'muse-spark-1.3',
    progressSync: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY),
  });
};
