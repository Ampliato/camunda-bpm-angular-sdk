'use strict';

angular
	.module("camForm", ["camBpmSdk"])
	.directive("camForm",function () {
		return {
			restrict: 'EA',

			scope: {
				processDefinition: "=",
				task: "=",
			},

			controller: function ($scope, $element, $compile, camApi) {
				var self = this;
				var container = angular.element($element.children()[0]);

				$scope.submitForm = function (done) {
					var data = {
						id: $scope.resourceId,
						variables: $scope.formScope.formVariables
					};

					camApi.resource($scope.resource).submitForm(data,
					function (error, result) {
						if (error) {
							if (done) {
								done(error, result);
							} else {
								throw error;
							}
						}

						if (done) {
							done(error, result);
						}
					});

				};

				function initializeForm () {
					$scope.formScope = $scope.$new();
					$scope.formScope.formVariables = {};
					$scope.formScope.variables = {};

					var parts = ($scope.formKey || "").split("embedded:");
					var context = ($scope.formContextPath || "");
					var client = camApi;
					var formUrl;

					if (parts.length > 1) {
						formUrl = parts.pop();
						// ensure a trailing slash
						context = context + (context.slice(-1) !== '/' ? '/' : '');
						formUrl = formUrl.replace(/app:(\/?)/, context);
					} else {
						formUrl = $scope.formKey;
					}

					loadVariables();

					if (formUrl) {
						camApi.http.load(formUrl, {
							done: function (error, formHtmlSource) {
								if (error) {
									throw error;
								}

								renderForm(formHtmlSource);
							}
						});

					} else {
						$scope.formScope.genericVariables = [];
						var formHtmlSource = "<cam-generic-form></cam-generic-form>";
						renderForm(formHtmlSource);
					}
				}

				function loadVariables () {
					camApi.http.get($scope.resource + "/" + $scope.resourceId + "/form-variables",
						{
							done : function (error, formVariables) {
								if (error) {
									throw error;
								}

								$scope.formScope.formVariables = formVariables;

								// Copy values to 'variables' object so that ngModel is satisfied
								for (var i in formVariables) {
									var variable = formVariables[i];
									$scope.formScope.variables[variable.name] = variable.value;
								}
							}
						});
				}

				function renderForm (formHtmlSource) {
					container.html("<div>" + formHtmlSource + "</div>");

					$compile(
						angular.element(container.children()[0]).contents()
					)($scope.formScope);
				}

				$scope.$watch("processDefinition", function () {
					if ($scope.processDefinition) {
						$scope.resource = "process-definition";
						$scope.resourceId = $scope.processDefinition.id;
						camApi.resource($scope.resource).startForm(
							{id: $scope.processDefinition.id},

							function (error, result) {
								if (error) {
									throw error;
								}

								if (result.key) {
									$scope.formKey = result.key;
									$scope.formContextPath = result.contextPath;

									initializeForm();
								}
						})
					}
				});

				$scope.$watch("task", function () {
					if ($scope.task) {
						$scope.resource = "task";
						$scope.resourceId = $scope.task.id;
						$scope.formKey = $scope.task.formKey;

						camApi.http.get("task/" + $scope.task.id + "/form",
						{
							done: function (error, result) {
								if (error) {
									throw error;
								}

								if (!$scope.task._embedded) {
									$scope.task._embedded = {};
								}

								$scope.task._embedded.form = result;
								$scope.formContextPath = result.contextPath;
								initializeForm();
							}
						});

					}
				});
			},

			link: function (scope, element, attrs) {

			},

			templateUrl: "directives/camForm/camForm.html"
		};
	})

	.directive("camVariableName", function () {
		return {
			restrict: "A",

			scope: false,

			require: ["ngModel", "^camForm"],

			controller: function () {},

			link: function (scope, element, attrs, controllers) {
				var ngModelController = controllers[0];

				// Pass ngModel changes to 'formVariables' object.
				scope.$watch(function () {
					return ngModelController.$modelValue;
				}, function () {
					if (scope.formVariables[attrs.camVariableName]) {
						scope.formVariables[attrs.camVariableName].value =
							ngModelController.$modelValue;
					} else {
						scope.formVariables[attrs.camVariableName] =
							{
								value: ngModelController.$modelValue,
								type: attrs.camVariableType
							};
					}
				});
			}
		};
	})

	.provider("camGenericFormConfiguration", function () {
		var typeInputs = {};

		this.registerTypeInput = function (type, inputHtmlSource) {
			typeInputs[type] = inputHtmlSource;
		};

		this.$get = [function () {
			return { typeInputs: angular.copy(typeInputs) };
		}];

		this.registerTypeInput("Default", "<input type='text' ng-model='variable.value' class='form-control'>");
		this.registerTypeInput("String", "<input type='text' ng-model='variable.value' class='form-control'>");
		this.registerTypeInput("Integer", "<input type='number' ng-model='variable.value' class='form-control'>");
		this.registerTypeInput("Boolean", "<input type='checkbox' ng-model='variable.value'>");
	})

	.directive("camGenericForm", function () {
		return {
			restrict: "AE",

			scope: true,

			require: ["^camForm"],

			controller: function ($scope, $element, camGenericFormConfiguration) {
				$scope.configuration = camGenericFormConfiguration;
				$scope.getTypeInput = function (type) {
					var inputHtmlSource = $scope.configuration.typeInputs[type];

					if (!inputHtmlSource) {
						inputHtmlSource = $scope.configuration.typeInputs["Default"];
					}

					return inputHtmlSource;
				}
			},

			link: function (scope, element, attrs, camFormController) {
				scope.genericVariables = [];

				scope.$watch("formVariables", function (newValue, oldValue) {
					scope.genericVariables = [];
					for (var i in scope.formVariables) {
						var formVariable = scope.formVariables[i];
						scope.genericVariables.push(
							{
								name: i,
								value: formVariable.value,
								type: formVariable.type
							});
					}
				});

				scope.submitGenericForm = function () {
					for (var i in scope.genericVariables) {
						var genericVariable = scope.genericVariables[i];

						if (scope.formVariables[genericVariable.name]) {
							scope.formVariables[genericVariable.name].value = genericVariable.value;
							scope.formVariables[genericVariable.name].type = genericVariable.type;
						} else {
							scope.formVariables[genericVariable.name] = genericVariable;
						}
					}

					scope.submitForm();
				}
			},

			templateUrl: "directives/camForm/camGenericForm.html"
		};
	})

	.directive("camGenericFormInput",
		["$compile",
		function ($compile) {
			return {
				restrict: "AE",

				scope: false,

				link: function (scope, element, attrs) {
					scope.$watch(function () {
						return attrs.htmlSource;
					}, function (value) {
						element.html(value);
						$compile(element.contents())(scope);
					});
				}

			}
	}]);
