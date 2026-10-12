const crypto = require('node:crypto');

function isAdminRequest(req) {
  const token = req.headers.cookie?.match(/(?:^|;\s*)odau_admin=([^;]+)/)?.[1];
  if (!token || !process.env.SESSION_SECRET) return false;
  const [expires, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', process.env.SESSION_SECRET).update(expires || '').digest('hex');
  if (!sig || sig.length !== expected.length) return false;
  return Number(expires) > Date.now() && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

module.exports = { isAdminRequest };
