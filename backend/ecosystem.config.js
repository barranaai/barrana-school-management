module.exports = {
  apps: [
    {
      name: 'barrana-backend',
      script: 'server.js',
      cwd: '/Users/faran/school-project/backend',
      instances: 1,
      autorestart: true,
      watch: false, // Set to true if you want auto-restart on file changes during development
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 5050
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5050
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      // Restart policy
      min_uptime: '10s',
      max_restarts: 10,
      // Advanced settings
      kill_timeout: 1600,
      listen_timeout: 3000,
      // Source map support
      source_map_support: true,
      // Merge logs from all instances
      merge_logs: true
    }
  ]
};
