const allowedIpPattern =
  /^(?:(?:10|127)\.(?:\d{1,3}\.){2}\d{1,3}|192\.168\.(?:\d{1,3}\.)\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.(?:\d{1,3}\.)\d{1,3})$/;

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
