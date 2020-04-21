const { development } = require('../knexfile');
const knex = require('knex');

module.exports = { knex: knex(development) };