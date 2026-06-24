module.exports = {
  apps: [
    {
      name: 'invoice-api',
      script: 'apps/api/dist/index.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
        API_PORT: 3001,
      },
    },
  ],
};
