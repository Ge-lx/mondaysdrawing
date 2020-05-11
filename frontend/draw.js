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
			return Int16Array.from(segments.flat(2));
		};

		const segmentsFromArrayBuffer = (int16Array) => {
			if (int16Array.length === 2) {
				return [[...int16Array]];
			}
			const segmentCount = int16Array.length / 6;
			const segments = Array(segmentCount);
			for (let i = 0; i < segmentCount; i++) {
				segments[i] = Array(3);
				for (let j = 0; j < 3; j++) {
					const k = i * 6 + j*2;
					segments[i][j] = [int16Array[k], int16Array[k+1]];
				}
			};
			return segments;
		};

		return { exportPath, segmentsToArrayBuffer, segmentsFromArrayBuffer };
	});

	define('PathHandler', (PathExportTools, ToolSettings, Listeners) => {
		const pathCompletedListeners = Listeners();
		const pathSegmentsListeners = Listeners();
		const pathStartedListeners = Listeners();

		const InternalPathHandler = (function () {
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
					InternalPathHandler.endActivePath();
				}
				InternalPathHandler.activePath = new paper.Path({ strokeColor, strokeWidth, strokeCap, segments });
			};

			InternalPathHandler.endActivePath = () => {
				InternalPathHandler.finishedPaths.push(InternalPathHandler.activePath);
				InternalPathHandler.activePath = null;
			};

			InternalPathHandler.clear = () => {
				if (InternalPathHandler.activePath !== null) {
					InternalPathHandler.endActivePath()	
				}

				for (let path of InternalPathHandler.finishedPaths) {
					if (path) {
						path.remove();	
					}
				}
				InternalPathHandler.finishedPaths = [];
			};

			InternalPathHandler.undo = () => {
				const pathToRemove = InternalPathHandler.finishedPaths.pop();
				pathToRemove.remove();
			};

			return InternalPathHandler;
		}());;

		const onPaperInitialized = () => {
			const drawingHandler = (function () {
				const segmentBufferCount = 5;
				let floatingPath;

				ToolSettings.onUndo(InternalPathHandler.undo);
				ToolSettings.onClear(InternalPathHandler.clear);

				const anchorFloatingPath = () => {
					floatingPath.simplify(1);
					const { segments = [] } = PathExportTools.exportPath(floatingPath);
					pathSegmentsListeners.trigger(segments);
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
						const lastSegment = (InternalPathHandler.activePath || { lastSegment: null }).lastSegment;
						floatingPath = new paper.Path(ToolSettings.getPathProperties(lastSegment));
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

				(function canvasSizing () {
					const CANVAS_PROPS = {
						MAX_WIDTH: 960,
						ASPECT_RATIO: 3/2
					};

					const refreshViewSize = () => {
						paper.view.center = new paper.Point(0, 0);

						const width = canvasHolder.clientWidth;
						paper.view.viewSize.width = width;
			            paper.view.viewSize.height = width / CANVAS_PROPS.ASPECT_RATIO;

			            const scale = width / CANVAS_PROPS.MAX_WIDTH;
			            paper.view.zoom = scale;
			            
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

	resolve((PathHandler, ToolSettings, PathExportTools, Socket, MessageTypes) => {
		var size = 0;

		PathHandler.onPathStarted((path) => Socket.send({ type: MessageTypes.PATH_START, path }));
		PathHandler.onPathCompleted(() => Socket.send({ type: MessageTypes.PATH_END }));
		PathHandler.onPathSegments((segments) => {
			const array = PathExportTools.segmentsToArrayBuffer(segments);
			Socket.send(array.buffer);
		});

		ToolSettings.onClear(() => Socket.send({ type: MessageTypes.PATH_CLEAR }));
		ToolSettings.onUndo(() => Socket.send({ type: MessageTypes.PATH_UNDO }));

		Socket.addBinaryListener((arrayBuffer) => {
			const array = new Int16Array(arrayBuffer);
			const segments = PathExportTools.segmentsFromArrayBuffer(array);
			PathHandler.InternalPathHandler.appendToActivePath(...segments);
		});

		// The order of segments and path_end is not always clean
		let pathEndReceived = false;
		Socket.addMessageListener((data) => {
			if (pathEndReceived) {
				PathHandler.InternalPathHandler.endActivePath();
				pathEndReceived = false;
			}

			switch (data.type) {
				case MessageTypes.PATH_START:
					PathHandler.InternalPathHandler.newActivePath(data.path);
					break;
				case MessageTypes.PATH_END:
					pathEndReceived = true;
					break;
				case MessageTypes.PATH_CLEAR:
					PathHandler.InternalPathHandler.clear();
					break;
				case MessageTypes.PATH_UNDO:
					PathHandler.InternalPathHandler.undo();
			}
		});
	});
}(bnc_bunch));