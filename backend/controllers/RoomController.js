const { knex } = require('../database/database');
const { validate, createShortId } = require('../utils');
const { defaultRoomConfig, registerNewSocket } = require('../logic/GameLogic');

const RoomController = {};

RoomController.getRoomByShortId = async (shortId) => {
	const foundRooms = await knex('rooms')
		.select(['drawTime', 'language', 'shortId'])
		.where({ shortId: shortId });

	if (foundRooms.length < 1) {
		throw new Error(`Could not find room with shortId ${shortId}`);
	} else if (foundRooms.length > 1) {
		throw new Error(`Found multiple rooms with shortId ${shortId}: ${foundRooms.length}`);
	} else {
		return foundRooms[0];
	}
};

RoomController.createRoom = async (req, res) => {
	const roomConfig = validate(req.body, {
		drawTime: { type: 'number', default: defaultRoomConfig.drawTime },
		language: { type: 'string', default: defaultRoomConfig.language }
	});

	const room = {
		shortId: createShortId(),
		...roomConfig
	};

	await knex('rooms').insert(room);

	return res.status(200).json(room);
};

RoomController.getRoom = async (req, res) => {
	res.status(200).json(req.room);
};

RoomController.updateRoom = async (req, res) => {
	const updateParams = validate(req.body, {
		drawTime: { type: ['number', 'undefined'] },
		language: { type: ['string', 'undefined'] }
	});

	const updatedRoom = req.room;

	for (param in updateParams) {
		if (updateParams[param]) {
			updatedRoom[param] = updateParams[param];
		}
	}

	const roomShortId = req.room.shortId;

	await knex('rooms')
		.update(updatedRoom)
		.where({ shortId: updatedRoom.shortId });

	return res.status(200).json(updatedRoom);
};

RoomController.getWebSocketForUser = async (req, res) => {
	const socketShortId = registerNewSocket(req.user, req.room);
	return res.status(200).json({ socketShortId })
}

module.exports = RoomController;
