(function ({ define, resolve, Observable, ComputedObservable }) {

	define('bind', () => {
		return (scope, element, obj) => {
			const results = {};
			for (let attributeName of obj) {
				const expression = element.getAttribute(attributeName);
				if (attributeName.endsWith('$')) {
					results[attributeName] = scope.$get$(expression);
				} else {
					results[attributeName] = scope.$get(expression);
				}
			}
			return results;
		};
	});

	define('currentUser', async (Store) => {
		const currentUser$ = Observable();

		try {
			currentUser$.value = await Store.CurrentUser().load();	
		} catch (error) {
			console.info('Could not find user.');
			currentUser$.value = null;
		}

		currentUser$.onChange(newUser => Store.CurrentUser().save(newUser));
		return currentUser$;
	});

	define('element_input', [{ noCache: true }, (bind) => {
		return {
			$template: `
				<div class="element_input__holder">
					<input type="text" bnc-model="model$"
						bnc-attr="name: input_name, readonly: input_readonly$.value, placeholder: input_placeholder"/>
					<div bnc-class="buttonClass$" bnc-click="submit()" bnc-bind="input_button_text"></div>
				</div>
			`,
			$link: (scope, element) => {
				const bindings = bind(scope, element, ['input_model$', 'input_name', 'input_readonly$', 'input_placeholder', 'input_button_text']);
				console.log('bindings: ', bindings);
				const model$ = Observable(bindings.input_model$.value);
				const buttonClass$ = ComputedObservable([bindings.input_readonly$, model$], (readonly, model) => {
					const show = bindings.input_readonly$.value !== true && model !== bindings.input_model$.value;
					return 'element_input__button ' + (show ? 'show' : 'hide');
				});
				const unbindExternalModule = bindings.input_model$.onChange(input => {
					model$.value = input || '';
				});

				const submit = () => {
					if (bindings.input_readonly$.value !== true) {
						bindings.input_model$.value = model$.value;
					}
				};

				const keyDownHandler = (event) => {
					if (event.code === 'Enter') {
						submit();
					}
				};
				
				element.addEventListener('keydown', keyDownHandler);
				scope.$onDestroy(() => {
					unbindExternalModule();
					buttonClass$.destroy();
					element.removeEventListener('keydown', keyDownHandler);
				});

				scope.$assign({
					...bindings,
					buttonClass$,
					model$,
					submit
				});
			},
		};
	}]);

	define('element_choice', [{ noCache: true }, (bind) => {
		return {
			$template: `
				<div class="element_choice__holder" bnc-for="choice in choices$">
					<div class="element_choice__choice clickable" bnc-click="selected$.value = choice">
						<div bnc-class="choiceClass_$(choice[choice_key])"></div>
						<div bnc-bind="choice[choice_name]"></div>
					</div>
				</div>
			`,
			$link: (scope, element) => {
				const bindings = bind(scope, element, ['choices$', 'selected$', 'choice_name', 'choice_key']);

				const choiceClassObservableMap = bindings.choices$.value.reduce((acc, curr) => {
					const thisChoiceKey = curr[bindings.choice_key];
					acc[thisChoiceKey] = ComputedObservable(bindings.selected$, selectedChoice => {
						return 'checkbox' + (selectedChoice[bindings.choice_key] === thisChoiceKey ? ' selected' : '');
					});
					return acc;
				}, {});

				// This prevents a memory leak, I think. Maybe the references are deleted though **hmm*
				scope.$onDestroy(() => {
					for (let observable of choiceClassObservableMap) {
						observable.destroy();
					}
				});

				const choiceClass_$ = (choiceKey) => {
					return choiceClassObservableMap[choiceKey];
				};

				scope.$assign({ ...bindings, choiceClass_$ });
			}
		};
	}]);

	define('element_user_edit', [{ noCache: true }, (Store, bind) => {
		return {
			$template: `
				<div class="element_user__holder">
					<div class="element_user_edit__image">
						<img src="/images/user.png">
					</div>
					<bnc-element name="element_input" class="element_user_edit__name"
						input_model$="name$"
						input_name="'name'"
						input_readonly$="false"
						input_placeholder="'Your Name'"
						input_button_text="'CREATE'">
					</bnc-element>
				</div>
			`,
			$link: (scope, element) => {
				const bindings = bind(scope, element, ['user$', 'user_is_create']);
				console.log('bindings: ', bindings)

				const name$ = Observable((bindings.user$.value || {}).name || '');
				const avatar$ = Observable((bindings.user$.value || {}) || 0x000);

				const submit = async () => {
					const user = {
						name: name$.value,
						// avatar: ElementUser.avatar$.value,
					};

					if (bindings.user_is_create) {
						return Store.User().create(user)
					} else {
						return Store.User({ userId: bindings.user$.value.shortId }).update(user);
					}
				};

				// React
				const unbindFromExternalUser = bindings.user$.onChange(user => {
					name$.value = user.name;
					avatar$.value = user.avatar;
				});

				const { destroy: destroyUpdateListener } = ComputedObservable(
					[name$, avatar$],
					async (name, avatar) => {
						const currentUser = bindings.user$.value || { name: '' };

						if (name && name !== currentUser.name /* && checkAvatar() */) {
							const updatedUser = await submit();
							bindings.user$.value = updatedUser;
						}
					});

				scope.$onDestroy(() => {
					unbindFromExternalUser();
					destroyUpdateListener();
				});		

				scope.$assign({ ...bindings, name$, avatar$ });
			}
		};
	}]);

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
				<div id="state_login__holder" class="panel">
					<div class="panel__header">
						<h2>Montagsmaler</h2>
					</div>
					<div class="panel__section highlighted">
						<h3>Welcome</h3>
						<div class="state_home__welcome">
							<p>
								Simple, online 'Montagsmaler' - Mobile and Desktop
								<br>
								To join a room, you need to choose your username.
							</p>
						</div>
					</div>
					<div class="panel__section">
						<h3Your name</h3>
						<div class="state_login__create_user">
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
		const currentName$ = ComputedObservable(currentUser$, user => (user || { name: '' }).name);

		const createUser = async () => {
			const user = await Store.User().create({ name: currentName$.value });
			currentUser$.value = user;
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
			$onEnter: () => {},
			$template: `
				<div id="state_home__popup" class="panel">
					<div class="panel__header">
						<h2>Montagsmaler</h2>
					</div>
					<div class="panel__section highlighted">
						<h3>Welcome</h3>
						<div class="state_home__welcome">
							<p>
								Simple, online 'Montagsmaler' - Mobile and Desktop
								<br>
								To join a room, you need to choose your username.
							</p>
						</div>
					</div>
					<div class="panel__section"
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
			LANGUAGES,
			currentRoomId$: Observable(''),
			language$,
			drawTime$,
			createRoom,
			joinRoom,
		};
	});

	define('element_user', [{ noCache: true }, () => {
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
				scope.$onDestroy(unbind);
			},
			name$,
		}
	}]);

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