const { knex } = require('../database/database');
const { validate, createShortId } = require('../utils');

const UserController = {};

UserController.getUserByShortId = async (shortId) => {
	const foundUsers = await knex('users')
		.select(['name', 'shortId'])
		.where({ shortId: shortId });

	if (foundUsers.length < 1) {
		throw new Error(`Could not find user with shortId ${shortId}`);
	} else if (foundUsers.length > 1) {
		throw new Error(`Found multiple users with shortId ${shortId}: ${foundUsers.map(user => user.name).join(' ')}`);
	} else {
		return foundUsers[0];
	}
};

UserController.createUser = async (req, res) => {
	const { name } = validate(req.body, {
		name: { type: 'string' }
	});

	const user = {
		shortId: createShortId(),
		name
	};

	await knex('users').insert(user);

	return res.status(200).json(user);
};

UserController.getUser = async (req, res) => {
	return res.status(200).json(req.user);
};

UserController.updateUser = async (req, res) => {
	const updateParams = validate(req.body, {
		name: { type: 'string' }
	});

	const userShortId = req.user.shortId;

	await knex('users')
		.update(updateParams)
		.where({ shortId: userShortId });

	const updatedUser = await UserController.getUserByShortId(userShortId);
	return res.status(200).json(updatedUser);
};

module.exports = UserController;
