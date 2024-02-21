const params = {
  name: "line-notify-utokyo-zenki",
  instances: 4,
  exec_mode: "cluster",
}

if(process.argv.indexOf('--env') !== -1) {
  params.name = "ut-notify-stg"
  params.instances = 1;
  params.exec_mode = "fork";
}

module.exports = {
  apps: [
    {
      name: params.name,
      script: "./dist/app.js",
      env: {
        NODE_ENV: "production",
      },
      env_staging: {
        NODE_ENV: "staging",
      },
      env_development: {
        NODE_ENV: "development",
      },
      instances: params.instances,
      exec_mode: params.exec_mode,
      max_memory_restart: "150M",
    },
  ],
};
