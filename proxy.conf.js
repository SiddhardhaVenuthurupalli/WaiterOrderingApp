module.exports = {
  '/proxy': {
    target: 'http://127.0.0.1:5000',
    secure: false,
    changeOrigin: true,
    pathRewrite: {
      '^/proxy': '',
    },
    router: (req) => {
      const targetIp = req.headers['x-target-ip'];
      return targetIp ? `http://${targetIp}:5000` : 'http://127.0.0.1:5000';
    },
  },
};
