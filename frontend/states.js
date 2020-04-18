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

	resolve((paper_canvas, PathExportTools) => {
		var size = 0;

		paper_canvas.onPathStarted((path) => {
			// console.log('onPathStarted');
			size += JSON.stringify(path).length * 2;
			// setTimeout(() => {
			// 	paper_canvas.startPath(path)
			// }, 2000);
		});
		paper_canvas.onPathCompleted(() => {
			// console.log('onPathCompleted');
			size += 'onPathCompleted'.length * 2;
			console.log('This path was ' + size + ' bytes');
			size = 0;
			// setTimeout(paper_canvas.completePath, 2000);
		});

		paper_canvas.onPathSegments((buffer) => {
			// console.log('Segments in byte: ', 2 * buffer.length);
			size += 3 * buffer.length;
			// console.log('onPathSegments: ', buffer);
			// setTimeout(() => {

			// 	const segments = PathExportTools.segmentsFromArrayBuffer(buffer);
			// 	paper_canvas.addPathSegments(segments);
			// }, 2000);
		});
	});

}(bnc_bunch));