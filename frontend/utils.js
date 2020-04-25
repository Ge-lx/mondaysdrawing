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
			},
			validate: (target, schema) => {
				const checkSchema = (target = {}, schema) => {
					const schemaProps = Object.keys(schema);
					const targetProps = Object.keys(target);
					const output = {};

					for (let prop of schemaProps) {
						const targetValue = target[prop];
						const propSchema = schema[prop];
						const defaultProvided = propSchema.hasOwnProperty('default');

						if (propSchema.type) {
							const validTypes = Array.isArray(propSchema.type) ? propSchema.type : [propSchema.type];
							const targetValueType = typeof targetValue;

							if (defaultProvided) {
								validTypes.push('undefined');
							}

							if (validTypes.includes(targetValueType) === false) {
								throw new Error(`Validation error! Expected ${prop} to have type ${validTypes.join(' or ')}. Got ${targetValueType}`);
							}
						}

						if (defaultProvided && targetValue === undefined) {
							output[prop] = propSchema.default;
						} else {
							output[prop] = target[prop];
						}
					}

					if (schemaProps.length < targetProps.length) {
						const extraProps = targetProps.filter(prop => schemaProps.includes(prop) === false);
						console.warn('Validation warning! You passed unexpected parameters: ', extraProps);
					}

					return output;
				};

				// Promise chaining
				if (schema === undefined) {
					schema = target;
					return (target) => checkSchema(target, schema);
				}
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