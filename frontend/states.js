(function ({ define, resolve, Observable, ComputedObservable }) {


	define('state_home', (path$) => {
		return {
			$go: () => path$.value = {},
			$when: path => Object.keys(path).length === 0,
			$template: `
				<div id="state_home__content">
					<p>Welcome</p>
				</div>
			`
		};
	});

	define('state_draw', (path$) => {
		return {
			$go: (room) => path$.value = { room },
			$when: path => path.room,
			$template: `
				<div id="state_draw__content">
					<div id="state_draw__sidebar">
						<bnc-element name="ToolSettings"></bnc-element>
					</div>
					<div id="state_draw__drawing_area">
						<bnc-element name="paper_canvas"></bnc-element>
					</div>
				</div>
			`,
			$link: (scope, element) => {

			}
		}
	});

	define('$states', () => ['state_home', 'state_draw']);

}(bnc_bunch));