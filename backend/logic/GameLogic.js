const { createShortId } = require('../utils');

const GameLogic = {};
const roomMap = {};

class Room {
	constructor (roomConfig) {
		this.config = roomConfig;
	}
}

class UserSocket {
	constructor (user, room) {
		this.user = user;
		this.room = room;
		this.shortId = createShortId();
	};

	connectWebSocket (ws) {
		this.socket = ws;
	};
}

GameLogic.defaultRoomConfig = {
	drawTime: 60,
	language: 'en'
};

GameLogic.createSocketUserInRoom = (user, room) => {
	const mappedRoom = roomMap[room.shortId];

	const socket
}

module.exports = GameLogic;