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

		class StoreError extends Error {
			static CODES = {
				GENERIC: { message: 'Something went wrong. Sorry about that.' },
				NETWORK: { message: 'Network error. Please make sure you are online and refresh the page.' },
				NOT_FOUND: { message: 'The requested resource could not be found.', http: 404 }
			};

			constructor (code, message, url, request) {
				if (typeof code === 'number') {
					code = Object.values(StoreError.CODES).find(({ http }) => http === code) || CODES.GENERIC;
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

			try {
				const response = await fetch(url, request);
				const data = await response.json();
				if (response.ok) {
					return data;
				} else {
					throw new StoreError(response.status, data.error, url, request);
				}
			} catch (error) {
				throw new StoreError(StoreError.CODES.NETWORK, error.message, url, request);
			}
		};
		
		const CacheGetter = (path, identifierValidation = {}) => {
			const validateIdentifiers = utils.validate(identifierValidation);
			return (identifiers = {}) => {
				identifiers = validateIdentifiers(identifiers);

				const storageKey = buildPath(path, identifiers);
				return JSON.parse(localStorage.getItem(storageKey));
			}
		};

		const CacheSetter = (path, identifierValidation = {}, payloadValidation = {}) => {
			const validateIdentifiers = utils.validate(identifierValidation);
			const validatePayload = utils.validate(payloadValidation);

			return (identifiers, payload) => {
				identifiers = validateIdentifiers(identifiers);
				payload = validatePayload(payload);

				const storageKey = buildPath(path, identifiers);
				return localStorage.setItem(path, JSON.stringify(payload));
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
				save: CacheSetter(CurrentUser.path, CurrentUser.identifiers, CurrentUser.payload),
				load: CacheGetter(CurrentUser.path, CurrentUser.identifiers)
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

		const Store = Object.keys(RESOURCES).reduce((Store, key) => {
			const Resource = RESOURCES[key];
			Store[key] = function ResourceInstance (identifiers) {
				return Object.keys(Resource.actions).reduce((Instance, key) => {
					const ActionHandler = Resource.actions[key];
					Instance[key] = payload => ActionHandler(identifiers, payload);
					return Instance;
				}, {});
			};
			return Store;
		}, {});

		Store.ErrorCodes = StoreError.CODES;
		return Store;
	});

}(bnc_bunch));