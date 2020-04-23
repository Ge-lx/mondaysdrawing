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
		const socket$ = Observable();
		const onMessageListeners = Listeners();
		const onBinaryListeners = Listeners();

		const socketUrl$ = ComputedObservable(SocketPath$, socketPath => {
			if (!socketPath) {
				return null;
			} else {
				return `${isLocal ? 'ws' : 'wss'}://${window.location.host}${socketPath}`;
			}
		});

		const heartbeat = (function () {
			const maxDeadTime = 5000 + 1000;
			const restartPoll = 5000;
			let timeout;

			return {
				alive: () => {
					clearTimeout(timeout);
					timeout = setTimeout(closeSocket, maxDeadTime);
				},
				clearTimeout: () => clearTimeout(timeout),
				restart: () => {
					clearTimeout(timeout);
					timeout = setTimeout(() => connectToUrl(socketUrl$.value), restartPoll);
				}
			};
		}());

		const closeSocket = ({ reason } = {}) => {
			if (reason === 'UNKNOWN') {
				console.info('Socket expired.');
				// Reloading the state gets new socket for current room and user
				resolve((path$) => path$.trigger());
			}
			const socket = socket$.value;
			if (socket) {
				online$.value = false;
				socket.close();
				socket$.value = null;
				console.info('Socket disconnected.');
			}

			heartbeat.restart();
		};

		const onSocketMessage = ({ data }) => {
			heartbeat.alive();
			if (data === 'ping') {
				return socket$.value.send('pong');
			}

			if (data instanceof Blob) {
				return data.arrayBuffer()
					.then(data => {
						return onBinaryListeners.trigger(new Uint16Array(data));
					});
			} else {
				onMessageListeners.trigger(JSON.parse(data));
			}
		};

		const connectToUrl = (url) => {
			const socket = new WebSocket(url);
			socket$.value = socket;

			socket.onopen = () => {
				heartbeat.alive();
				online$.value = true;
				console.info('Socket connected.');
			};
			socket.onerror = (errorEvent) => {
				// ignored
			};
			socket.onclose = closeSocket;
			socket.onmessage = onSocketMessage;
		};

		socketUrl$.stream(socketUrl => {
			if (socketUrl === null) {
				closeSocket();
			} else {
				connectToUrl(socketUrl)
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