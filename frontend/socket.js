(function ({ define, resolve, Observable, ComputedObservable }) {

	define('Socket', (isLocal) => {
		const activeWebSocket$ = Observable({ send: () => {}, close: () => {} });


		const online$ = Observable(false);

		let autoReconnect = true;
		const reconnectIfNeeded = () => {
			if (autoReconnect !== false) {
				setTimeout(createSocket, 5000);
			}
		};

		const createSocket = () => {
			let socket;
			try {
				socket = new WebSocket(`${isLocal ? 'ws' : 'wss'}://${window.location.host}/socket`);
			} catch (error) {
				return reconnectIfNeeded();
			} 
			socket.onopen = () => {
				online$.value = true;
				socket$.value = socket;
			};

			socket.onclose = (close) => {
				console.log('Socket closed.', close);
				online$.value = false;
				reconnectIfNeeded();
			};
			return socket;
		};

		const reconnect = () => {
			if ([2, 3].includes(socket$.value.readyState) === false) {
				autoReconnect = false;
				socket$.value.close();
			}
			createSocket();
			autoReconnect = true;
		};

		createSocket();
		return { socket$, online$, reconnect };
	});

}(bnc_bunch));