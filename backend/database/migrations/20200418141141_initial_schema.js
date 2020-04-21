exports.up = (knex) => {

	const createUsersTable = knex.schema
		.createTable('users', (table) => {
			table.increments('id');
			table.string('shortId').notNullable();
			table.string('name');
		});

	const createRoomsTable = knex.schema
		.createTable('rooms', (table) => {
			table.increments('id');
			table.string('shortId').notNullable();
			table.integer('drawTime').notNullable();
			table.string('language').notNullable();
		});

	return Promise.all([createUsersTable, createRoomsTable]);
};

exports.down = (knex) => {
	const dropUsersTable = knex.schema.dropTable('users');
	const dropRoomsTable = knex.schema.dropTable('rooms');

	return Promise.all([dropUsersTable, dropRoomsTable]);
};
