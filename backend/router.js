const path = require('path');
const express = require('express');
const express_ws = require('express-ws');
const { AsyncRouter } = require('express-async-router');

const UserController = require('./controllers/UserController');
const RoomController = require('./controllers/RoomController');
const GameLogic = require('./logic/GameLogic');

const DIR_FRONTEND = path.join(__dirname, '../frontend');
const FILE_INDEX = path.join(DIR_FRONTEND, 'index.html');

const HttpRouter = (app) => {
	const router = AsyncRouter({ send: false });

	// Users
	router.param('userId', async (req, res, param) => {
		try {
			req.user = await UserController.getUserByShortId(param);
		} catch (error) {
			res.status(404).json({ error: error.message });
		}
	});
	router.put('/users', UserController.createUser);
	router.put('/user/:userId', UserController.updateUser);
	router.get('/user/:userId', UserController.getUser);


	// Rooms
	router.param('roomId', async (req, res, param) => {
		try {
			req.room = await RoomController.getRoomByShortId(param);
		} catch (error) {
			res.status(404).json({ error: error.message });
		}
	});
	router.put('/rooms', RoomController.createRoom);
	router.put('/room/:roomId', RoomController.updateRoom);
	router.get('/room/:roomId', RoomController.getRoom);
	router.post('/room/:roomId/user/:userId', RoomController.getWebSocketForUser);

	app.use('/api', router);
};

const WebSocketRouter = (app) => {
	express_ws(app);

	// express-ws does not support promisified route handlers
	app.ws('/ws/:socketShortId', (ws, req) => {
		return GameLogic.connectWebSocket(req.params.socketShortId, ws);
	});
};

const StaticRouter = (app) => {
	app.use(express.static(DIR_FRONTEND));
	app.get('/', (req, res) => {
	    res.sendFile(
	        FILE_INDEX,
	        {
	            dotfiles: 'deny',
	            headers: {
	                'x-timestamp': Date.now(),
	                'x-sent': true,
	            },
	        },
	        (err) => {
	            if (err) {
	                next(err)
	            } else {
	                console.log(`Client index.html served to ${req.ip} on ${req.originalUrl}`);
	            }
	        });
	});
};

const initialize = (app) => {
	HttpRouter(app);
	WebSocketRouter(app);
	StaticRouter(app);
};

module.exports = { initialize };