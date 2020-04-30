(function ({ define, resolve, Observable, ComputedObservable }) {
	define('Store', (utils) => {
		const BASEURL = `${window.location.origin}/api`;
		const buildPath = (function () {
			const regex = /\/:([^/]+)/g;
			return (template, params) => {
				return template.replace(regex, (match, key) => {
					return '/' + params[key];
				});
			};
		}());
		const buildUrl = (pathTemplate, params) => {
			return BASEURL + buildPath(pathTemplate, params);
		};

		const ErrorCodes = {
			GENERIC: { message: 'Something went wrong. Sorry about that.' },
			NETWORK: { message: 'Network error. Please make sure you are online and refresh the page.' },
			NOT_FOUND: { message: 'The requested resource could not be found.', http: 404 }
		};
		class StoreError extends Error {
			constructor (code, message, url, request) {
				if (typeof code === 'number') {
					code = Object.values(ErrorCodes).find(({ http }) => http === code) || ErrorCodes.GENERIC;
				}
				super(message || code.message);

				this.name = 'StoreError';
				this.code = code;
				this.url = url;
				this.request = request;
			};
		};

		const sendFetch = async (method = 'GET', url, body) => {
			const request = {
				method,
				mode: 'cors',
				cache: 'no-cache',
				redirect: 'follow',
				referrerPolicy: 'origin'
			};

			if (typeof body === 'object') {
				request.headers = { 'Content-Type': 'application/json' };
				request.body = JSON.stringify(body)
			}

			
			let response;
			try {
				response = await fetch(url, request);
			} catch (error) {
				throw new StoreError(ErrorCodes.NETWORK, error.message, url, request);
			}
			const data = await response.json();
			if (response.ok) {
				return data;
			} else {
				throw new StoreError(response.status, data.error, url, request);
			}
		
		};

		const CacheGetter = (path, identifierValidation = {}) => {
			const validateIdentifiers = utils.validate(identifierValidation);
			return (identifiers = {}) => {
				identifiers = validateIdentifiers(identifiers);

				const storageKey = buildPath(path, identifiers);
				const parsed = JSON.parse(localStorage.getItem(storageKey));
				return Promise.resolve(parsed);
			}; 
		};

		const CacheSetter = (path, identifierValidation = {}, payloadValidation = {}) => {
			const validateIdentifiers = utils.validate(identifierValidation);
			const validatePayload = utils.validate(payloadValidation);

			return (identifiers, payload) => {
				identifiers = validateIdentifiers(identifiers);
				payload = validatePayload(payload);

				const storageKey = buildPath(path, identifiers);
				localStorage.setItem(path, JSON.stringify(payload));
				return Promise.resolve();
			};
		};

		const CacheDeleter = (path, identifierValidation = {}) => {
			const validateIdentifiers = utils.validate(identifierValidation);
			return (identifiers = {}) => {
				identifiers = validateIdentifiers(identifiers);

				const storageKey = buildPath(path, identifiers);
				localStorage.removeItem(storageKey);
				return Promise.resolve();
			};
		};

		const ResourceGetter = (path, identifierValidation = {}) => {
			const validateIdentifiers = utils.validate(identifierValidation);

			return (identifiers = {}) => {
				identifiers = validateIdentifiers(identifiers);

				const url = buildUrl(path, identifiers);
				return sendFetch('GET', url);
			};
		};

		const ResourceSetter = (path, identifierValidation = {}, payloadValidation = {}, method = 'PUT') => {
			const validateIdentifiers = utils.validate(identifierValidation);
			const validatePayload = utils.validate(payloadValidation);

			return (identifiers, payload) => {
				identifiers = validateIdentifiers(identifiers);
				payload = validatePayload(payload);

				const url = buildUrl(path, identifiers);
				return sendFetch(method, url, payload);
			};
		};

		let Store;
		const RESOURCES = (function () {
			const User = {
				identifiers: { userId: { type: 'string' } },
				payload: { name: 'string' },
				paths: {
					root: '/users',
					instance: '/user/:userId'
				}
			};
			User.actions = {
				create: ResourceSetter(User.paths.root, {}, User.payload),
				load: ResourceGetter(User.paths.instance, User.identifiers),
				update: ResourceSetter(User.paths.instance, User.identifiers, User.payload)
			};

			const CurrentUser = {
				identifiers: {},
				payload: { ...User.payload, shortId: { type: 'string' } },
				path: '/current-user'
			};
			CurrentUser.actions = {
				delete: CacheDeleter(CurrentUser.path, CurrentUser.identifiers),
				save: CacheSetter(CurrentUser.path, CurrentUser.identifiers, CurrentUser.payload),
				load: (function () {
					const cacheGetter = CacheGetter(CurrentUser.path, CurrentUser.identifiers);
					return (...args) => {
						return cacheGetter(...args)
							.then(cachedUser => {
								if (!cachedUser) {
									return cachedUser;
								}
								return Store.User({ userId: cachedUser.shortId }).load();
							})
							.catch(error => {
								if (error.code === ErrorCodes.NOT_FOUND) {
									return Store.CurrentUser()
										.delete()
										.then(() => null);
								} else {
									throw error;
								}
							})
							.then(user => {
								if (!user) {
									throw new StoreError(ErrorCodes.NOT_FOUND, 'Could not find current user.');
								} else {
									return user;
								}
							});
					};
				}())					
			};

			const Room = {
				identifiers: { roomId: { type: 'string' } },
				payload: {
					drawTime: { type: 'number', default: 60 },
					language: { type: 'string', default: 'en' }
				},
				paths: {
					root: '/rooms',
					instance: '/room/:roomId',
					user: '/room/:roomId/user/:userId'
				}
			};
			Room.actions = {
				create: ResourceSetter(Room.paths.root, {}, Room.payload),
				load: ResourceGetter(Room.paths.instance, Room.identifiers, Room.payload),
				update: ResourceSetter(Room.paths.instance, Room.identifiers, Room.payload),
				getWebSocket: ResourceSetter(Room.paths.user, { ...Room.identifiers, ...User.identifiers }, {}, 'POST')
			};

			return { User, CurrentUser, Room };
		}());

		Store = Object.keys(RESOURCES).reduce((Store, key) => {
			const resource = RESOURCES[key];
			Store[key] = function ResourceInstance (identifiers) {
				return Object.keys(resource.actions).reduce((Instance, key) => {
					const actionHandler = resource.actions[key];
					Instance[key] = payload => Promise.resolve(payload)
						.then(payload => actionHandler(identifiers, payload));
					return Instance;
				}, {});
			};
			return Store;
		}, {});

		Store.ErrorCodes = ErrorCodes;
		return Store;
	});

}(bnc_bunch));