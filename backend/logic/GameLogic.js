const { createShortId } = require('../utils');

const GameLogic = {};
const roomMap = {};
const userSocketsByUserShortId = {};
const userSocketsByShortId = {};
const noop = () => {};

GameLogic.defaultRoomConfig = {
	drawTime: 60,
	language: 'en'
};

const MessageTypes = {
	USERS: 0,
	CHAT: 1,
	TURN_START: 2,
	TURN_END: 3,
	PATH_START: 4,
	PATH_END: 5,
	PATH_UNDO: 6,
	PATH_CLEAR: 7
};

class Room {
	constructor (roomConfig) {
		this.config = roomConfig;
		this.userSocketsByUserShortId = {};
	};

	broadcastUsers () {
		const users = {};
		for (let userId in this.userSocketsByUserShortId) {
			const userSocket = this.userSocketsByUserShortId[userId];
			const { name } = userSocket.user;
			users[userId] = { name, isOnline: userSocket.isOnline() };
		}
		this.broadcast({ type: MessageTypes.USERS, users });
	}

	broadcast (data, except) {
		for (let userId in this.userSocketsByUserShortId) {
			if (userId === except) {
				continue;
			} else {
				try {
					this.userSocketsByUserShortId[userId].send(data);
				} catch (error) {
					// ignored
				}
			}
		}
	};

	join (userSocket) {
		const userShortId = userSocket.user.shortId;
		this.userSocketsByUserShortId[userShortId] = userSocket;

		userSocket.onMessage(data => {
			const forwardTypes = [
				MessageTypes.PATH_START,
				MessageTypes.PATH_END,
				MessageTypes.PATH_UNDO,
				MessageTypes.PATH_CLEAR
			];
			if (forwardTypes.includes(data.type)) {
				this.broadcast(data, userShortId);
			}
		});

		userSocket.onBinary(data => {
			this.broadcast(data, userShortId);
		});

		userSocket.onConnectionChange(() => {
			this.broadcastUsers();
		});
	};
};


class UserSocket {
	constructor (user, room) {
		this.user = user;
		this.room = room;
		this.shortId = createShortId();
		this.alive = true;

		this.onMessageHandler = noop;
		this.onBinaryHandler = noop;
		this.onConnectionChangeHandler = noop;

		this.room.join(this);
	};

	onMessage (callback){ this.onMessageHandler = callback	};
	onConnectionChange (callback) { this.onConnectionChangeHandler = callback };
	onBinary (callback) { this.onBinaryHandler = callback };

	isOnline () {
		return this.socket && this.socket.readyState === 1;
	};

	heartbeat () {
		if (this.socket && this.isOnline()) {
			if (this.alive === false) {
				return this.closeWebSocket(true);	
			} else {
				this.socket.send('ping');
				this.alive = false;
			}
		}
	};

	send (data) {
		if ((data instanceof Uint16Array || data instanceof Buffer) === false && typeof data === 'object') {
			data = JSON.stringify(data);
		}
		this.socket.send(data);
	};

	connectWebSocket (ws) {
		this.socket = ws;
		ws.onmessage = (message) => {
			this.alive = true;

			if (message.data === 'pong') {
				return;
			} 
			const isMessage = typeof message.data === 'string';

			if (isMessage) {
				this.onMessageHandler(JSON.parse(message.data));
			} else {
				this.onBinaryHandler(message.data);
			}
		};
		ws.onerror = (event) => console.error('Error in WebSocket: ', event);
		ws.onclose = ({ reason }) => this.closeWebSocket(reason);
		this.onConnectionChangeHandler();
	};

	closeWebSocket (terminate = false) {
		if (!this.socket) {
			return;
		}
		this.onConnectionChangeHandler();
		if (terminate) {
			return this.socket.terminate();
		} else {
			return this.socket.close();
		}
	};
};

(function heartbeatSockets () {
	setInterval(() => {
		Object.values(userSocketsByShortId).forEach(socket => socket.heartbeat());
	}, 5000);
}());

GameLogic.connectWebSocket = (socketShortId, ws) => {
	const mappedUserSocket = userSocketsByShortId[socketShortId];
	if (mappedUserSocket !== undefined) {
		mappedUserSocket.connectWebSocket(ws);
	} else {
		setTimeout(() => ws.close(1000, 'UNKNOWN'), 500);
	}
};

GameLogic.registerNewSocket = (user, roomConfig) => {
	let room = roomMap[roomConfig.shortId];
	if (room === undefined) {
		room = new Room(roomConfig);
		roomMap[room.shortId] = room;
	}
	const existingSocketForUser = userSocketsByUserShortId[user.shortId];
	if (existingSocketForUser !== undefined) {
		if (existingSocketForUser.isOnline()) {
			existingSocketForUser.closeWebSocket(true);
		}
		return existingSocketForUser.shortId;
	} else {
		const socket = new UserSocket(user, room);
		userSocketsByUserShortId[user.shortId] = socket;
		userSocketsByShortId[socket.shortId] = socket;
		return socket.shortId;
	}
	
};

module.exports = GameLogic;