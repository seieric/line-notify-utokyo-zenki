module.exports = {
  apps: [
    {
      name: "line-notify-utokyo-zenki",
      script: "./dist/app.js",
      env_production: {
        NODE_ENV: "production",
      },
      env_development: {
        NODE_ENV: "development",
      },
      instances: 4,
      exec_mode: "cluster",
      max_memory_restart: "150M",
    },
  ],
};
