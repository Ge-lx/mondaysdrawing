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

	define('element_input', [{ noCache: true }, (bind) => {
		return {
			$template: `
				<div class="element_input__holder">
					<input class="clickable" type="text" bnc-model="model$"
						bnc-attr="name: input_name, readonly: input_readonly$.value, placeholder: input_placeholder"/>
					<div bnc-class="buttonClass$" bnc-click="submit()" bnc-bind="input_button_text"></div>
				</div>
			`,
			$link: (scope, element) => {
				const bindings = bind(scope, element, ['input_model$', 'input_name', 'input_readonly$', 'input_placeholder', 'input_button_text', 'input_show_button']);
				
				const model$ = Observable(bindings.input_model$.value);
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

				const shouldShowButton = (function () {
					switch (bindings.input_show_button || 'CHANGED') {
						case 'NON_EMPTY':
							return (model, external) => model !== '';
						case 'CHANGED': // fall through
						default:
							return (model, external) => model !== external;
					}
				}());

				element.addEventListener('keydown', keyDownHandler);
				const unbindExternalModule = bindings.input_model$.onChange(input => {
					model$.value = input || '';
				});
				const buttonClass$ = ComputedObservable([bindings.input_readonly$, model$], (readonly, model) => {
					const externalValue = bindings.input_model$.value;
					const canEdit = bindings.input_readonly$.value !== true;
					const show = canEdit && shouldShowButton(model, externalValue);
					return 'element_input__button' + (show ? '' : ' hide');
				});

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
				<div class="element_user_edit__holder">
					<div class="element_user_edit__image">
						<img src="/images/user.png">
					</div>
					<bnc-element name="element_input" class="element_user_edit__name"
						input_model$="name$"
						input_name="'name'"
						input_readonly$="false"
						input_placeholder="'Your Name'"
						input_button_text="user_is_create ? 'CREATE' : 'UPADTE'">
					</bnc-element>
				</div>
			`,
			$link: (scope, element) => {
				const bindings = bind(scope, element, ['user$', 'user_is_create']);

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

				const unbindFromExternalUser = bindings.user$.onChange(user => {
					name$.value = user.name;
					avatar$.value = user.avatar;
				});

				const { destroy: destroyUpdateListener } = ComputedObservable(
					[name$, avatar$],
					async (name, avatar) => {
						const currentUser = bindings.user$.value || { name: '' };

						// Name cannot be empty
						if (!name) {
							name$.value = currentUser.name;
						}
						if (name !== currentUser.name /* && checkAvatar() */) {
							const updatedUser = await submit();
							bindings.user$.value = updatedUser;
						}
					});

				scope.$onDestroy(() => {
					unbindFromExternalUser();
					destroyUpdateListener();
					name$.destroy();
					avatar$.destroy();
				});		

				scope.$assign({ ...bindings, name$, avatar$ });
			}
		};
	}]);

	define('element_user', [{ noCache: true }, (bind, currentUser$) => {
		return {
			$template: `
				<div bnc-class="'element_user__holder' + (isMe ? ' me' : '')">
					<div class="element_user__image">
						<img src="/images/user.png">
					</div>
					<p class="element_user__name" bnc-bind="name$"></p>
					<p class="element_user__ping" bnc-bind="status$"></p>
				</div>
			`,
			$link: (scope, element) => {
				const { user$ } = bind(scope, element, ['user$']);
				const name$ = ComputedObservable(user$, user => {
					return user ? (user.name || '<no name>') : '<no user>';
				});
				const status$ = ComputedObservable(user$, user => {
					if (!user) {
						return '?'
					}
					if (user.isOnline) {
						const ping = user.ping || 0;
						return `${ping} ms`;
					} else {
						return 'offline';
					}
				});

				scope.$onDestroy(() => {
					name$.destroy();
					status$.destroy();
				});
				scope.$assign({
					name$, status$,
					isMe: user$.value.shortId === currentUser$.value.shortId
				});
			},
		};
	}]);

	define('users', (Socket, MessageTypes) => {
		const users$ = Observable({});
		Socket.addMessageListener(data => {
			if (data.type === MessageTypes.USERS) {
				const users = data.users;
				for (let shortId in users) {
					users[shortId].shortId = shortId;
				}
				users$.value = users;
			}
		});
		return users$;
	});
	define('element_user_list', (Socket, MessageTypes, utils, users$) => {
		return {
			$template: `
				<div class="panel inline">
					<div class="panel__header">
						<h3 bnc-bind="roomLink$"></h3>
					</div>
					<div class="panel__section" bnc-for="userId, user of users$">
						<div class="panel__row">
							<bnc-element name="element_user" bnc-attr="userId: userId" user$="user"></bnc-element>
						</div>
					</div>
				</div>
			`,
			$link: (scope, element) => {
				const roomLink$ = ComputedObservable(scope.$get$('room$'), room => {
					if (!room) {
						return '<no room>';
					}
					const roomShortId = room.shortId;
					return `${window.location.origin}/#${utils.serializeQueryParams({ room: room.shortId })}`;
				});

				scope.$onDestroy(roomLink$.destroy);
				scope.$assign({ roomLink$ });
			},
			users$,
		};
	});

	define('element_chat', (Socket, MessageTypes, utils, users$) => {
		// We dont use bnc-elements for individual messages for performance reasons
		const messageLog = (function () {
			let messageContainer = null;

			const getMesageHTML = ({ name, isSystem, message }) => `
				<div class="element_chat__message${isSystem ? ' system' : ''}">
					<p>${name || ''}</p>
					<p class="message">${utils.escapeHTML(message)}</p>
				</div>
			`;

			const addMessage = ({ name, isSystem = false, message }) => {
				if (messageContainer) {
					const messageHTML = getMesageHTML({ name, isSystem, message });
					messageContainer.insertAdjacentHTML('beforeend', messageHTML);
				} else {
					console.error('Message container is not ready!');
				}
			};

			return {
				linkMessageContainer: (element) => messageContainer = element,
				addMessage
			};
		}());

		Socket.addMessageListener(data => {
			if (data.type === MessageTypes.CHAT) {
				const user = users$.value[data.userId] || { name: 'Info' };
				messageLog.addMessage({ name: user.name, message: data.message, isSystem: false });
			}
		});

		const chatInput$ = Observable('');
		chatInput$.onChange(chatInput => {
			if (!chatInput) {
				return;
			}
			Socket.send({
				type: MessageTypes.CHAT,
				message: chatInput,
			});
			return '';
		});

		return {
			$template: `
				<div class="panel inline element_chat">
					<div class="panel__header">
						<h3>Chat</h3>
					</div>
					<div class="panel__section element_chat__messages">
					</div>
					<div class="panel__section highlighted">
						<bnc-element class="panel__row"
							name="element_input"
							input_model$="chatInput$"
							input_button_text="'SEND'"
							input_show_button="'NON_EMPTY'"
						></bnc-element>
					</div>
				</div>
			`,
			$link: (scope, element) => {
				messageLog.linkMessageContainer(element.querySelector('.element_chat__messages'));
			},
			chatInput$
		};
	});
}(bnc_bunch));