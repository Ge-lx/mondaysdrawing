(function ({ define, resolve, load, Observable, ComputedObservable }) {

	define('bnc_router', (fragment$, $states) => {
		// Bind the path backend
		const path$ = fragment$;
		define('path', () => path$);

		// Check $states definition
		if (Array.isArray($states) === false) {
			console.error('bnc_router expectes \´$states\ to be defined an array of the state\'s module\'s names. Got ', $states);
		}
		return Promise
			.all($states
				.map(stateName => load(stateName)
					.then(({ value: loadedModule }) => {
						const isValidModule = ['$when', '$go'].every(ident => typeof loadedModule[ident] === 'function');
						if (!isValidModule) {
							console.error(`Could not load '${stateName}' because it is not a valid state: `, loadedModule);
							return null;
						}
						loadedModule.$name = stateName;
						return loadedModule;
					})
					.catch(error => {
						console.error(`Could not load '${stateName}': `, error);
						return null;
					})))
			.then(loadedAndFaliedStates => loadedAndFaliedStates.filter(state => state !== null))
			.then(states => {
				const currentState$ = Observable();

				path$.stream((path, oldPath) => {
					const matchingStates = states.filter(state => state.$when(path));
					if (matchingStates.length > 1) {
						console.error('Multiple states matched ', { path, matchingStates });
					} else if (matchingStates.length < 1) {
						console.error('No state matched ', { path });
					} else {
						const newState = matchingStates[0];
						const oldState = currentState$.value;
						if (newState === oldState) {
							return;
						}
						if (oldState && typeof oldState.$onLeave === 'function') {
							oldState.$onLeave();
						}
						if (typeof matchingStates[0].$onEnter === 'function') {
							matchingStates[0].$onEnter();
						}
						currentState$.value = newState;
					}
				});

				const currentStateName$ = ComputedObservable(currentState$, state => state.$name);
				return {
					path$,
					currentState$,
					currentStateName$,
					states,
					$template: `<bnc-state name="currentStateName$"></bnc-state>`
				};
			});
	});
}(bnc_bunch));