module.exports = {
  development: {
    client: 'sqlite3',
    useNullAsDefault: true,
    connection: {
      filename: './database/db.sqlite3'
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: './database/migrations'
    }
  }
};