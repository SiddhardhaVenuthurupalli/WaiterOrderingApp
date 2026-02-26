const allowedIpPattern =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d?|0)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d?|0)$/;

const normalizeTargetIp = (value) => {
  const ip = `${value ?? ''}`.trim();
  return allowedIpPattern.test(ip) ? ip : '';
};

module.exports = {
  '/proxy': {
    target: 'http://127.0.0.1:5000',
    secure: false,
    changeOrigin: true,
    pathRewrite: {
      '^/proxy': '',
    },
    router: (req) => {
      const targetIp = normalizeTargetIp(req.headers['x-target-ip']);
      return targetIp ? `http://${targetIp}:5000` : 'http://127.0.0.1:5000';
    },
  },
};
