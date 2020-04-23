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

	define('state_draw', (path$, Store, SocketPath$) => {
		const room$ = Observable();
		const goHome = () => resolve((state_home) => state_home.$go());

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
				<div id="state_draw__content">
					<div id="state_draw__sidebar">
						<h3 style="font-family: 'Times New Roman'" bnc-bind="ComputedObservable(room$, room => (room || {}).shortId)"></h3>
						<bnc-element name="ToolSettings"></bnc-element>
					</div>
					<div id="state_draw__drawing_area">
						<bnc-element name="PathHandler"></bnc-element>
					</div>
				</div>
			`,
			$link: (scope, element) => {

			},
			room$,
		}
	});

	define('$states', () => ['state_home', 'state_draw']);

}(bnc_bunch));