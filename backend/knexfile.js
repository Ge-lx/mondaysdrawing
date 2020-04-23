module.exports = {
  development: {
    client: 'sqlite3',
    useNullAsDefault: true,
    connection: {
      filename: './backend/database/db.sqlite3'
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: './backend/database/migrations'
    }
  }
};