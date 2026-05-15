module.exports = {
  apps: [{
    name: 'cs2-api',
    script: './index.js',
    cwd: '/var/www/cs2sim/backend',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
    },
  }],
};
