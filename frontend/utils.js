(function ({ define, resolve, Observable, ComputedObservable }) {
	
	define('utils', () => {
		return {
			serializeQueryParams: (obj) => Object.keys(obj)
				.map((key) => obj[key] ? `${key}=${encodeURIComponent(obj[key])}` : key)
				.join('&'),
			parseQueryParms: (str) => {
				if (!str) {
					return {};
				}
				return str.split('&').reduce((obj, arg) => {
					const [key, val] = arg.split('=');
					const decoded = val ? decodeURIComponent(val) : undefined;
					obj[key] = decoded;
					return obj;
				}, {});
			}
		};
	});

	define('isLocal', () => {
		return ['localhost', '127.0.0.1'].includes(window.location.hostname) || window.location.hostname.startsWith('192.168.');
	});

	define('fragment', (utils) => {
		const fragment$ = Observable();
		const onHashChange = () => {
			const parsedFragment = utils.parseQueryParms(window.location.hash.substring(1));
			fragment$.value = parsedFragment;
		};

		fragment$.onChange((newObj, oldObj) => {
			if (newObj !== oldObj) {
				window.location.hash = utils.serializeQueryParams(newObj)	
			}
		});
		window.addEventListener('hashchange', onHashChange);

		onHashChange();
		return fragment$;
	});

	define('Listeners', () => {
		return () => {
			let listeners = [];

			const trigger = (value) => listeners.forEach(listener => listener(value));
			const add = (listener) => {
				listeners.push(listener);
				return () => listeners = listeners.filter(x => x !== listeners);
			};

			return { trigger, add };
		};
	});

}(bnc_bunch));