(function ({ define, resolve, Observable, ComputedObservable }) {

	define('currentUser', async (Store) => {
		const currentUser$ = Observable();

		try {
			currentUser$.value = await Store.CurrentUser().load();	
		} catch (error) {
			console.info('Could not find user.');
			currentUser$.value = null;
		}

		currentUser$.onChange(newUser => {
			Store.CurrentUser().save(newUser);
			return newUser;
		});
		return currentUser$;
	});

	define('state_login', (path$, Store, currentUser$) => {
		const previousPath$ = Observable({});

		const StateLogin = {
			$when: (path) => path.hasOwnProperty('login'),
			$go: () => path$.value = { login: undefined },
			$onEnter: () => {
				if (currentUser$.value) {
					resolve((state_home) => state_home.$go());
				}
			},
			$template: `
				<div id="state_login__holder" class="panel big">
					<div class="panel__header">
						<h2>Montagsmaler</h2>
					</div>
					<div class="panel__section highlighted">
						<h3>Welcome</h3>
						<div class="panel__row">
							<p>
								Simple, online 'Montagsmaler' - Mobile and Desktop
								<br>
								To join a room, you need to choose your username.
							</p>
						</div>
					</div>
					<div class="panel__section">
						<div class="panel__row">
							<bnc-element name="element_user_edit" user_is_create="true" user$="currentUser$">
						</div>
					</div>
			`,
			currentUser$
		};

		path$.stream((newPath, oldPath) => {
			if (StateLogin.$when(newPath)) {
				if (currentUser$.value) {
					return oldPath;
				}
			} else {
				previousPath$.value = newPath;
			}
		});

		currentUser$.stream(user => {
			if (!user) {
				StateLogin.$go(path$.value);
			} else if (StateLogin.$when(path$.value) && previousPath$.value) {
				path$.value = previousPath$.value;
			}
		});

		return StateLogin;
	});

	define('state_home', (path$, Store, currentUser$) => {
		const drawTime$ = Observable(60);
		const LANGUAGES = [
			{ name: 'English', key: 'en' },
			{ name: 'German', key: 'de' },
			{ name: 'Spanish', key: 'es' },
			{ name: 'French', key: 'fr' },
		];
		const language$ = Observable(LANGUAGES[0]);
		const createRoom = async () => {
			const room = await Store.Room().create({
				drawTime: parseInt(drawTime$.value),
				language: language$.value.key,
			});
			resolve((state_draw) => state_draw.$go(room.shortId));
		};
		const currentRoomId$ = Observable('');
		currentRoomId$.onChange(roomId => {
			if (roomId) {
				resolve((state_draw) => state_draw.$go(roomId));
			}
		});

		return {
			$go: () => path$.value = {},
			$when: path => Object.keys(path).length === 0,
			$onEnter: () => {},
			$template: `
				<div class="panel big">
					<div class="panel__header">
						<h2>Montagsmaler</h2>
					</div>

					<div class="panel__section">
						<bnc-element class="panel__row" name="element_user_edit" user_is_create="false" user$="currentUser$">
					</div>

					<div class="panel__section highlighted">
						<h3>Create a new room</h3>
						<div class="panel__row">
							<p>Time to draw</p>
							<input class="clickable" placeholder=60 type="number" min="1" max="3600" bnc-model="drawTime$"/>
						</div>

						<div class="panel__row">
							<p class="start">Language</p>
							<bnc-element name="element_choice" choices$="LANGUAGES" selected$="language$" choice_name="'name'" choice_key="'key'">
							</bnc-element>
						</div>
						
						<div class="panel__row">
							<button class="state_home__button_go" bnc-click="createRoom()">GO</button>
						</div>
					</div>

					<div class="panel__section">
						<div class="panel__row">
							<h3>or enter a room ID</h3>
							<bnc-element name="element_input"
								input_model$="currentRoomId$"
								input_name="'room_id'"
								input_readonly$="false"
								input_placeholder="'Room ID'"
								input_button_text="'JOIN'">
							</bnc-element>
						</div>
					</div>
				</div>
			`,
			currentUser$,
			LANGUAGES,
			currentRoomId$: Observable(''),
			language$,
			drawTime$,
			createRoom,
		};
	});

	define('state_draw', (path$, Store, SocketPath$, ToolSettings, utils) => {
		const room$ = Observable();
		const user$ = Observable();
		const goHome = () => resolve((state_home) => state_home.$go());

		const linkToRoom$ = ComputedObservable(room$, room => {
			if (!room) {
				return;
			}
			const roomShortId = room.shortId;
			return `${window.location.origin}/#${utils.serializeQueryParams({ room: room.shortId })}`;
		});

		return {
			$go: (room) => path$.value = { room },
			$when: path => path.room,
			$onEnter: async () => {
				console.log('enter state_draw');
				try {
					room$.value = await Store.Room({ roomId: path$.value.room }).load();
				} catch (error) {
					console.error('Could not find room with id ', path$.value.room);
					return goHome();
				}
				
				try {
					const user = await Store.CurrentUser().load();
					const { socketShortId } = await Store
						.Room({ userId: user.shortId, roomId: room$.value.shortId})
						.getWebSocket();
					
					user$.value = user;
					SocketPath$.value = `/ws/${socketShortId}`;
				} catch (error) {
					return goHome();
				}

				
			},
			$onLeave: async () => {
				console.log('leave state_draw');
				SocketPath$.value = null;
			},
			$template: `
				<div id="state_draw__header">
					<div>
						<p>Montagsmaler</p>
					</div>
					<div class="state_draw__room_code__holder">
						<pre bnc-bind="linkToRoom$"></pre>
						<div class="button" bnc-click="copyRoomLink()">COPY</div>
					</div>
					
				</div>
				<div id="state_draw__content">
					<div id="state_draw__sidebar">
						<!--<bnc-element name="Chat"></bnc-element>-->
					</div>
					<div id="state_draw__drawing-area">
						<bnc-element name="PathHandler"></bnc-element>
						<div class="state_draw__toolbar-holder">
							<bnc-element name="ToolSettings"></bnc-element>
						</div>
					</div>
				</div>
			`,
			$link: (scope, element) => {

			},
			room$,
			user$,
			linkToRoom$,
			copyRoomLink: () => {
				navigator.clipboard.writeText(linkToRoom$.value);
			},
			isDrawing$: ToolSettings.isDrawing$,
		}
	});

	define('$states', () => ['state_login', 'state_home', 'state_draw']);

}(bnc_bunch));