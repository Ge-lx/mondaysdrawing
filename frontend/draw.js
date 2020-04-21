(function ({ define, resolve, Observable, ComputedObservable }) {

	define('ToolSettings', (Listeners) => {
		const COLORS = ['#1a1a1a', '#4d4d4d', '#bababa', '#ffffff', '#9e0142', '#d53e4f', '#f46d43', '#fa9fb5', '#fdae61', '#fee08b', '#ffffbf', '#e6f598', '#abdda4', '#66c2a5', '#3288bd', '#5e4fa2'];
		const TOOLS = [
			{ type: 'pen', strokeWidth: 4, uiCircleSize: '10px' },
			{ type: 'pen', strokeWidth: 8, uiCircleSize: '15px' },
			{ type: 'pen', strokeWidth: 12, uiCircleSize: '20px' },
			{ type: 'pen', strokeWidth: 16, uiCircleSize: '25px' },
			{ type: 'undo' },
			{ type: 'clear' }
		];

		const onClearListeners = Listeners();
		const onUndoListeners = Listeners();
		const strokeColor$ = Observable(COLORS[0]);
		const strokeWidth$ = Observable(TOOLS[1].strokeWidth);
		const isDrawing$ = Observable(true);

		const getPathProperties = (...initialSegments) => {
			return {
				segments: initialSegments,
				strokeColor: strokeColor$.value,
				strokeWidth: strokeWidth$.value,
				strokeCap: 'round',
			};
		};

		return {
			$template: `
				<div id="tool_settings">
					<div class="tool_settings__section" bnc-for="tool in TOOLS">
						<div bnc-click="onToolClicked(tool)"
							bnc-class="ComputedObservable(strokeWidth$, value => value === tool.strokeWidth ? 'selected' : '')">
							<div bnc-if="tool.type === 'pen'" class="circle"
								bnc-css="width: tool.uiCircleSize, height: tool.uiCircleSize">
							</div>
							<p bnc-if="tool.type === 'undo'">⤺</p>
							<p bnc-if="tool.type === 'clear'">♼</p>
						</div>
					</div>
					<div class="tool_settings__section" bnc-for="color in COLORS">
						<div bnc-click="strokeColor$.value = color"
							bnc-class="ComputedObservable(strokeColor$, value => value === color ? 'selected' : '')">
							<div class="circle" bnc-css="background: color"></div>
						</div>
					</div>
				</div>
			`,
			$link: (scope, element) => {},
			onToolClicked: (tool) => {
				switch (tool.type) {
					case 'pen':
						strokeWidth$.value = parseInt(tool.strokeWidth);
						break;
					case 'undo':
						if (isDrawing$.value === true) {
							onUndoListeners.trigger();	
						}
						break;
					case 'clear':
						if (isDrawing$.value === true) {
							onClearListeners.trigger();
						}
						break;
				}
			},
			COLORS,
			TOOLS,
			strokeColor$,
			strokeWidth$,
			isDrawing$,
			getPathProperties,
			onUndo: onUndoListeners.add,
			onClear: onClearListeners.add
		};
	});

	define('PathExportTools', () => {
		const exportPath = (path) => {
			const exported = path.exportJSON({ precision: 1, asString: false });
			const { strokeColor, strokeWidth, strokeCap, segments = [], id } = exported[1];
			return { strokeColor, strokeWidth, strokeCap, segments, id };
		};

		const segmentsToArrayBuffer = (segments = []) => {
			return Uint16Array.from(segments.flat().map(x => x + 100));
		};

		const segmentsFromArrayBuffer = (uint16Array) => {
			const segmentCount = uint16Array.length / 2;
			const segments = Array(segmentCount);
			for (let i = 0; i < segmentCount; i++) {
				const j = i*2;
				segments[i] = [uint16Array[j], uint16Array[j+1]];
			};
			return segments;
		};

		return { exportPath, segmentsToArrayBuffer, segmentsFromArrayBuffer };
	});

	define('paper_canvas', (PathExportTools, ToolSettings, Listeners) => {
		const pathCompletedListeners = Listeners();
		const pathSegmentsListeners = Listeners();
		const pathStartedListeners = Listeners();

		let InternalPathHandler;
		const onPaperInitialized = (paper) => {
			InternalPathHandler = (function () {
				const InternalPathHandler = {
					finishedPaths: [],
					activePath: null
				};

				InternalPathHandler.appendToActivePath = (...segments) => {
					if (segments.length === 0) {
						return;
					}
					if (InternalPathHandler.activePath !== null) {
						InternalPathHandler.activePath.add(...segments);
						InternalPathHandler.activePath.reduce();
					} else {
						console.error('Trying to add segments without and active path!');
					}
				};

				InternalPathHandler.newActivePath = ({ strokeColor, strokeWidth, strokeCap, segments }) => {
					if (InternalPathHandler.activePath !== null) {
						endActivePath();
					}
					InternalPathHandler.activePath = new paper.Path({ strokeColor, strokeWidth, strokeCap, segments });
				};

				InternalPathHandler.endActivePath = () => {
					InternalPathHandler.finishedPaths.push(InternalPathHandler.activePath);
					InternalPathHandler.activePath = null;
				};

				InternalPathHandler.clear = () => {
					for (let path of InternalPathHandler.finishedPaths) {
						path.remove();
					}
					InternalPathHandler.finishedPaths = [];
				};

				InternalPathHandler.undo = () => {
					const pathToRemove = InternalPathHandler.finishedPaths.pop();
					pathToRemove.remove();
				};

				return InternalPathHandler;
			}());

			const drawingHandler = (function () {
				const segmentBufferCount = 5;
				let floatingPath;

				ToolSettings.onUndo(InternalPathHandler.undo);
				ToolSettings.onClear(InternalPathHandler.clear);

				const anchorFloatingPath = () => {
					floatingPath.simplify(1);
					const { segments = [] } = PathExportTools.exportPath(floatingPath);
					const exportedSegments = PathExportTools.segmentsToArrayBuffer(segments);
					pathSegmentsListeners.trigger(exportedSegments);
					InternalPathHandler.appendToActivePath(...segments);
					floatingPath.remove();
				};

				const tool = new paper.Tool();
				tool.onMouseDown = (event) => {
					if (ToolSettings.isDrawing$.value !== true) {
						return;
					}

					if (InternalPathHandler.activePath !== null) {
						InternalPathHandler.endActivePath();
					}
					InternalPathHandler.newActivePath(ToolSettings.getPathProperties());
					floatingPath = new paper.Path(ToolSettings.getPathProperties(event.point));

					const exported = PathExportTools.exportPath(InternalPathHandler.activePath);
					pathStartedListeners.trigger(exported);
				};

				tool.onMouseDrag = (event) => {
					if (ToolSettings.isDrawing$.value !== true) {
						return;
					}

					floatingPath.add(event.point);
					if (floatingPath.segments.length > segmentBufferCount) {
						anchorFloatingPath();
						floatingPath = new paper.Path(ToolSettings.getPathProperties(InternalPathHandler.activePath.lastSegment));
					}
				};

				tool.onMouseUp = (event) => {
					if (ToolSettings.isDrawing$.value !== true) {
						return;
					}

					// Paths with just one segment are invisible. As well as paths with just two identical segments
					if (InternalPathHandler.activePath.segments.length < 2) {
						const segment = floatingPath ? floatingPath.lastSegment : InternalPathHandler.activePath.lastSegment;
						const point = segment.point.clone();
						point.x += 1;
						floatingPath.add(point);
					}
					anchorFloatingPath();
					InternalPathHandler.endActivePath();
					pathCompletedListeners.trigger();
				};
			}());
		};

		return {
			$template: `
				<div id="canvas_holder">
					<canvas></canvas>
				</div>
			`,
			$link: (scope, element) => {
				const canvasHolder = element.querySelector('#canvas_holder');
				const canvas = canvasHolder.querySelector('canvas');
				paper.setup(canvas);

				(function fitCanvasToHolder () {
					const refreshViewSize = () => {
						const [width, height] = [canvasHolder.scrollWidth, canvasHolder.scrollHeight];
						console.log('resized: ', {width, height});
						paper.view.viewSize.width = width;
			            paper.view.viewSize.height = height;
					};
			        const observer = new ResizeObserver(refreshViewSize);
			        observer.observe(canvasHolder);
			        refreshViewSize();
			    }());

				onPaperInitialized(paper);
			},
			onPathSegments: pathSegmentsListeners.add,
			onPathCompleted: pathCompletedListeners.add,
			onPathStarted: pathStartedListeners.add,
			InternalPathHandler
		};
	});

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