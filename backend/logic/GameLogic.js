const { createShortId } = require('../utils');

const GameLogic = {};
const roomMap = {};
const userSockestByUserShortId = {};
const userSocketsByShortId = {};

GameLogic.defaultRoomConfig = {
	drawTime: 60,
	language: 'en'
};

class Room {
	constructor (roomConfig) {
		this.config = roomConfig;
		this.userSockestByUserShortId = {};
	}

	connectUserSocket (userSocket) {
		const userShortId = userSocket.user.shortId;
		if (this.userSockestByUserShortId[userShortId] !== undefined) {
			delete this.userSockestByUserShortId[userShortId];
		}
		this.userSockestByUserShortId[userShortId] = userSocket;
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
		ws.onmessage = (message) => {
			const dataType = typeof message.data;
			console.log('message, dataType: ', { message, dataType });
		};
	};

	terminateWebSocket (reason) {
		if ([2, 3].includes(this.socket.readyState) === false) {
			this.socket.close(1000, reason);
		};
	};
};

GameLogic.connectWebSocket = (socketShortId, ws) => {
	const mappedUserSocket = userSockestByUserShortId[user.shortId];
	if (mappedUserSocket === undefined) {
		if ([2, 3].includes(ws.readyState) === false) {
			ws.close();
		}
	} else {
		mappedUserSocket.connectWebSocket(ws);
	}
};

GameLogic.registerNewSocket = (user, roomConfig) => {
	let room = roomMap[room.shortId];
	if (room === undefined) {
		room = new Room(roomConfig);
		roomMap[room.shortId] = room;
	}
	const existingSocketForUser = userSockestByUserShortId[user.shortId];
	if (existingSocketForUser !== undefined) {
		existingSocketForUser.terminateWebSocket();
		delete userSockestByUserShortId[user.shortId];
	}
	const socket = new UserSocket(user, room);
	userSockestByUserShortId[user.shortId] = socket;
	return socket.shortId;
};

module.exports = GameLogic;