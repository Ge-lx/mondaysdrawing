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
				const bindings = bind(scope, element, ['input_model$', 'input_name', 'input_readonly$', 'input_placeholder', 'input_button_text']);
				
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

				element.addEventListener('keydown', keyDownHandler);
				const unbindExternalModule = bindings.input_model$.onChange(input => {
					model$.value = input || '';
				});
				const buttonClass$ = ComputedObservable([bindings.input_readonly$, model$], (readonly, model) => {
					const show = bindings.input_readonly$.value !== true && model !== bindings.input_model$.value;
					return 'element_input__button ' + (show ? 'show' : 'hide');
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
				<div class="element_user__holder">
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

						if (name && name !== currentUser.name /* && checkAvatar() */) {
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
}(bnc_bunch));