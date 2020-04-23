const { development } = require('./knexfile');
const knex_migrate = require('knex-migrate');
const knex = require('knex');

module.exports = {
	migrate: async () => await knex_migrate('up',
		{ knexfile: './backend/database/knexfile.js'},
		({ action, migration }) => console.log(`${action} : ${migration}`)),
	knex: knex(development) };