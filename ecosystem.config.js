module.exports = {
  apps: [{
    name: 'vertix',
    script: './dist/src/index.js',
    cwd: '/var/vertix',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3005
    }
  }]
};
