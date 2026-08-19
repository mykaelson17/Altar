module.exports = {
  apps: [
    {
      name: "gestao-igreja",
      script: ".output/server/index.mjs",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      max_memory_restart: "512M",
      out_file: "logs/out.log",
      error_file: "logs/err.log",
    },
  ],
};
