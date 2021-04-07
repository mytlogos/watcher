module.exports = {
  type: "sqlite",
  database: "watcher.db",
  host: "localhost",
  synchronize: true,
  logging: false,
  entities: ["dist/server/entity/**/*.js"],
  migrations: ["dist/server/migration/**/*.js"],
  subscribers: ["dist/server/subscriber/**/*.js"],
  cli: {
    migrationsDir: "src/server/migration",
  },
};
