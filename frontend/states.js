(function ({ define, resolve, Observable, ComputedObservable }) {

	define('state_home', (path$, Store) => {
		const currentUser$ = Observable(null);
		const currentName$ = Observable((currentUser$.value || { name: '' }).name);
		const updateCurrentUser = async () => {
			try {
				currentUser$.value = await Store.CurrentUser().load();
				currentName$.value = currentUser$.value.name;
			} catch (error) {
				currentUser$.value = null;
			}
		};
		updateCurrentUser();

		const createUser = async () => {
			const user = await Store.User().create({ name: currentName$.value });
			currentUser$.value = user;
			await Store.CurrentUser().save(user);
		};

		const updateUser = async () => {
			const updatedUser = {
				name: currentName$.value
			};

			if (!updatedUser.name || updatedUser.name === '') {
				currentName$.value = currentUser$.value.name;
				return;
			}

			const user = await Store
				.User({ userId: currentUser$.value.shortId })
				.update(updatedUser);
			await Store.CurrentUser().save(user);
			await updateCurrentUser();
		};


		const drawTime$ = Observable(60);
		const language$ = Observable('en');
		const LANGUAGES = [
			{ name: 'English', key: 'en' },
			{ name: 'Deutsch', key: 'de' }
		];
		const createRoom = async () => {
			const room = await Store.Room().create({
				drawTime: drawTime$.value,
				language: language$.value
			});
			joinRoom(room.shortId);
		};

		const joinRoom = (roomId) => {
			resolve((state_draw) => state_draw.$go(roomId));
		};

		return {
			$go: () => path$.value = {},
			$when: path => Object.keys(path).length === 0,
			$onEnter: () => {
				updateCurrentUser();
			},
			$template: `
				<div id="state_home__popup">
					<div class="state_home_panel">
						<div class="state_home__create_user" bnc-if-not="currentUser$">
							<h3>Create User</h3>
							<input placeholder="Your name" type="name" bnc-model="currentName$"/>
							<button bnc-click="createUser()">Create</button>
						</div>
						
						<div class="state_home__change_user" bnc-if="currentUser$">
							<input placeholder="Your name cannot be empty" type="name" bnc-model="currentName$"/>
							<button bnc-click="updateUser()">Save</button>
						</div>
					</div>
					<div class="state_home_panel" bnc-if="currentUser$">
						<div class="state_home__join_room">
							<h3>Join a room by entering its ID below</h3>
							<input placeholder"ID" type="text" name="roomId" bnc-model="currentRoomId$"/>
							<button bnc-click="joinRoom(currentRoomId$.value)">Join</button>

						</div>
						<div class="state_home__create_room">
							<h3>Or create your own room</h3>
							<input placeholder=60 type="number" min="1" max="3600" bnc-model="drawTime$"/>
							<div class="state_home__create_room__languages" bnc-for="lang in LANGUAGES">
								<div class="state_home__create_room__language"
									bnc-class="ComputedObservable(language$, key => lang.key === key ?
										'state_home__create_room__language selected' :
										'state_home__create_room__language')"
									bnc-click="language$.value = lang.key"
									bnc-bind="lang.name">
								</div>
							</div>
							<button bnc-click="createRoom()">Create</button>
						</div>
					</div>
				</div>
			`,
			currentName$,
			currentUser$,
			createUser,
			updateUser,
			LANGUAGES,
			currentRoomId$: Observable(''),
			language$,
			drawTime$,
			createRoom,
			joinRoom,
		};
	});

	define('element_user', () => {
		const user$ = Observable({});
		const name$ = ComputedObservable(user$, user => user.name || '');
		return {
			$template: `
				<div class="element_user__holder">
					<div class="element_user__image">
						<img src="/images/user.png">
					</div>
					<p class="element_user__name" bnc-bind="name$"></p>
				</div>
			`,
			$link: (scope, element) => {
				const userExpression = element.getAttribute('user');
				const evaluatedUser$ = Observable(scope.$get(userExpression));

				const unbind = evaluatedUser$.stream(user => {
					if (!user) {
						user = {};
					}
					user$.value = user;
				});
				scope.onDestroy(unbind);
			},
			name$,
		}
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
						<bnc-element name="element_user" user="user$"></bnc-element>
					</div>
					<div class="state_draw__room_code__holder">
						<pre bnc-bind="linkToRoom$"></pre>
						<div class="button" bnc-click="copyRoomLink()">COPY</div>
					</div>
					
				</div>
				<div id="state_draw__content">
					<div id="state_draw__sidebar">
						<bnc-element name="Chat"></bnc-element>
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

	define('$states', () => ['state_home', 'state_draw']);

}(bnc_bunch));