const shortid = require('shortid');
shortid.characters('αβγδεζηθικλμabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');

module.exports = {
	createShortId: shortid.generate,
	validate: (target, schema) => {
		const checkSchema = (target = {}, schema) => {
			const schemaProps = Object.keys(schema);
			const targetProps = Object.keys(target);
			const output = {};

			for (prop of schemaProps) {
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
		} else {
			return checkSchema(target, schema);
		}
	}
};
