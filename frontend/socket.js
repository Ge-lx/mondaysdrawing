(function ({ define, resolve, Observable, ComputedObservable }) {

	define('MessageTypes', () => {
		return {
			USERS: 0,
			CHAT: 1,
			TURN_START: 2,
			TURN_END: 3,
			PATH_START: 4,
			PATH_END: 5,
			PATH_UNDO: 6,
			PATH_CLEAR: 7,
		};
	});
	define('SocketPath', () => Observable(''));
	define('Socket', (isLocal, SocketPath$, Listeners, MessageTypes) => {
		const online$ = Observable(false);
		const socket$ = Observable(null);
		const onMessageListeners = Listeners();
		const onBinaryListeners = Listeners();

		const heartbeat = (function () {
			const maxDeadTime = 5000 + 1000;
			const restartPoll = 5000;
			let timeout;

			return {
				alive: () => {
					clearTimeout(timeout);
					timeout = setTimeout(() => closeSocket({ reason: 'ABANDONED' }), maxDeadTime);
				},
				restart: () => {
					clearTimeout(timeout);
					timeout = setTimeout(openSocket, restartPoll);
				},
				clearTimeout: () => clearTimeout(timeout),
			};
		}());

		const openSocket = () => {
			if (socket$.value !== null) {
				return;
			}

			const socketUrl = socketUrl$.value;
			if (socketUrl === null) {
				return;
			}

			const socket = new WebSocket(socketUrl);
			socket$.value = socket;

			socket.onclose = closeSocket;
			socket.onmessage = onSocketMessage;
			socket.onerror = (errorEvent) => { /* ignored */ };
			socket.onopen = () => {
				online$.value = true;
				console.info('Socket connected.');
			};

			heartbeat.alive();
		};

		const closeSocket = ({ reason } = {}) => {
			if (reason === 'UNKNOWN') {
				console.info('Socket expired.');
				// Reloading the state gets new socket for current room and user
				resolve((state_draw) => state_draw.$onEnter());
			}
			const socket = socket$.value;
			if (socket) {
				online$.value = false;
				socket.close();
				socket$.value = null;
				console.info('Socket disconnected. ', reason);
			}
			heartbeat.restart();
		};

		const onSocketMessage = ({ data }) => {
			heartbeat.alive();
			if (data === 'ping') {
				return socket$.value.send('pong');
			}

			if (data instanceof Blob) {
				const responseConsumer = new Response(data);
				return responseConsumer.arrayBuffer()
					.then(onBinaryListeners.trigger);
			} else {
				onMessageListeners.trigger(JSON.parse(data));
			}
		};

		const socketUrl$ = ComputedObservable(SocketPath$, socketPath => {
			if (!socketPath) {
				return null;
			} else {
				return `${isLocal ? 'ws' : 'wss'}://${window.location.host}${socketPath}`;
			}
		});

		socketUrl$.stream(socketUrl => {
			if (socketUrl === null) {
				closeSocket({ reason: 'EXIT' });
			} else {
				openSocket();
			}
		});

		return {
			socket$,
			online$,
			addMessageListener: onMessageListeners.add,
			addBinaryListener: onBinaryListeners.add,
			send: (data) => {
				if (online$.value !== true) {
					return;
				}

				if (data instanceof ArrayBuffer === false && typeof data === 'object') {
					data = JSON.stringify(data);
				}
				socket$.value.send(data);
			}
		};
	});
}(bnc_bunch));