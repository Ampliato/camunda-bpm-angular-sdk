'use strict';

angular
	.module("camForm", ["camApi"])
	.directive("camForm", function () {
		return {
			restrict: 'EA',

			scope: {
				processDefinition: "=",
				task: "="
			},

			controller: function ($scope, $element, $compile, $http, camApi) {
				var self = this,
					container = angular.element($element.children()[0]);

				$scope.$watch("processDefinition", function () {
					if ($scope.processDefinition) {
						$scope.resource = "process-definition";
						$scope.resourceId = $scope.processDefinition.id;

						camApi
							.resource("process-definition")
							.get($scope.resourceId + "/startForm")
							.success(function (result) {
								if (result.key) {
									$scope.formKey = result.key;
									$scope.formContextPath = result.contextPath;

									initializeForm();
								}
							});
					}
				});

				$scope.$watch("task", function () {
					if ($scope.task) {
						$scope.resource = "task";
						$scope.resourceId = $scope.task.id;
						$scope.formKey = $scope.task.formKey;

						camApi
							.resource("task")
							.get($scope.resourceId + "/form", { headers: { "Accept": "*"} })
							.success(function (result) {
									if (!$scope.task._embedded) {
										$scope.task._embedded = {};
									}

									$scope.task._embedded.form = result;
									$scope.formContextPath = result.contextPath;

									initializeForm();
								});
					}
				});

				$scope.submitForm = function (businessKey, done) {
					if (typeof(businessKey) == 'function') {
						done = businessKey;
						businessKey = null;
					}

					if (!$scope.variablesForm.$valid) {
						$scope.$emit("camForm.invalidForm", $scope.variablesForm);

						return;
					}

					var data = {
						id: $scope.resourceId,
						key: businessKey,
						variables: serializeFormVariables($scope.formScope.formVariables)
					};

					$scope.$emit("camForm.submittingForm", data);

					camApi
						.resource($scope.resource)
						.post(
							data.id + "/submit-form",
							{
								data: {
										businessKey: data.key,
										variables: data.variables
									}
							})
						.success(function (data, status) {
							$scope.$emit("camForm.formSubmitted", data);

							if (done) {
								done(data, status);
							}
						})
						.error(function (data, status) {
							$scope.$emit("camForm.formSubmitFailed", status);

							if (done) {
								done(data, status);
							} else {
								throw error;
							}
						});
				};

				function initializeForm () {
					$scope.formScope = $scope.$new();
					$scope.formScope.formVariables = {};

					var parts = ($scope.formKey || "").split("embedded:"),
						context = ($scope.formContextPath || ""),
						client = camApi,
						formUrl;

					if (parts.length > 1) {
						formUrl = parts.pop();

						// ensure a trailing slash
						context = context + (context.slice(-1) !== '/' ? '/' : '');
						formUrl = formUrl.replace(/app:(\/?)/, context);
					} else {
						formUrl = $scope.formKey;
					}

					loadVariables(
						function (variables, status) {
							if (formUrl) {
								$scope.$emit("camForm.loadingForm");
								$http
									.get(formUrl)
									.success(function (data, status) {
										renderForm(data);

										$scope.$emit("camForm.formLoaded", data);
									})
									.error(function (data, status) {
										$scope.$emit("camForm.formLoadFailed", data, status);
									});
							} else {
								$scope.formScope.genericVariables = [];

								var formHtmlSource = "<cam-generic-form></cam-generic-form>";
								renderForm(formHtmlSource);

								$scope.$emit("camForm.genericFormInitialized");
							}
						}
					);

				}

				function loadVariables (done) {
					$scope.$emit("camForm.loadingVariables");

					camApi
						.resource($scope.resource)
						.get($scope.resourceId + "/form-variables")
						.success(function (formVariables, status) {
							$scope.$emit("camForm.variablesLoaded", formVariables);

							$scope.formScope.formVariables =
								deserializeFormVariables(formVariables);

							if (done) {
								done(formVariables, status);
							}
						})
						.error(function (data, status) {
							$scope.$emit("camForm.variablesLoadFailed", data, status);

							if (done) {
								done(data, status);
							} else {
								throw error;
							}
						});
				}

				function renderForm (formHtmlSource) {
					container.html("<div>" + formHtmlSource + "</div>");

					$compile(
						angular.element(container.children()[0]).contents()
					)($scope.formScope);
				}

				function serializeFormVariables (formVariables) {
					var serializedFormVariables = angular.copy(formVariables);
					for (var i in serializedFormVariables) {
						var formVariable = serializedFormVariables[i];

						if (formVariable.value instanceof Object) {
							var value = {
								type: formVariable.type,
								object: formVariable.value
							};

							formVariable.value = JSON.stringify(value);
							formVariable.type = "String";
						}
					}

					return serializedFormVariables;
				}

				function deserializeFormVariables (formVariables) {
					var deserializedFormVariables = angular.copy(formVariables);
					for (var i in deserializedFormVariables) {
						var formVariable = deserializedFormVariables[i];

						// Check if String is JSON
						if (formVariable.type === "String" &&
							formVariable.value &&
							isJSON(formVariable.value)) {
							var variable = JSON.parse(formVariable.value);

							formVariable.value = variable.object;
							formVariable.type = variable.type;
						}
					}

					return deserializedFormVariables;
				}

			},

			templateUrl: "directives/camForm/camForm.html"
		};
	})

	.directive("camVariableName", function ($compile) {
		return {
			restrict: "A",

			scope: false,

			require: ["^camForm"],

			terminal: true,

			priority: 1000,

			link: function (scope, element, attrs) {
				var variableName = attrs.camVariableName;
				var variableType = attrs.camVariableType;
				var ngModel = attrs.ngModel;


				if (!scope.formVariables[variableName]) {
					scope.formVariables[variableName] = {
						name: variableName,
						type: variableType || "String"
					};
				}

				var modelName = "formVariables['" + variableName + "'].value";

				if (!ngModel || ngModel !== modelName) {
					element.attr("ng-model", modelName);
				}

				element.removeAttr("cam-variable-name");
				element.removeAttr("cam-variable-type");

				$compile(element)(scope);
			},

		};
	})

	.provider("camGenericFormConfiguration", function () {
		var configuration = {
			typeInputs: {},
			properties: {}
		};

		this.registerTypeInput = function (type, inputHtmlSource) {
			configuration.typeInputs[type] = inputHtmlSource;
		};

		this.setProperty = function (key, value) {
			configuration.properties[key] = value;
		};

		this.$get = [function () {
			return angular.copy(configuration);
		}];

		// Default Configuration
		this.registerTypeInput("String", "<input type='text' ng-model='variable.value' class='form-control'>");
		this.registerTypeInput("Integer", "<input type='number' ng-model='variable.value' class='form-control'>");
		this.registerTypeInput("Long", "<input type='number' ng-model='variable.value' class='form-control'>");
		this.registerTypeInput("Double", "<input type='number' ng-model='variable.value' class='form-control'>");
		this.registerTypeInput("Boolean", "<input type='checkbox' ng-model='variable.value'>");
		this.registerTypeInput("Date", "<input type='datetime-local' ng-model='variable.value'>");

		this.setProperty("formTitle", "Generic Form");
		this.setProperty("addVariableLabel", "Add variable");
		this.setProperty("submitFormLabel", "Submit generic form");
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
						inputHtmlSource = $scope.configuration.typeInputs["String"];
					}

					return inputHtmlSource;
				};

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

				scope.addVariable = function () {
					scope.genericVariables.push(
						{
							name: "",
							value: "",
							type: "String"
						}
					);
				};

				scope.removeVariable = function (index) {
					scope.genericVariables.splice(index, 1);
				};

				scope.submitGenericForm = function () {
					for (var i in scope.genericVariables) {
						var genericVariable = scope.genericVariables[i];

						if (!i) continue;

						if (scope.formVariables[genericVariable.name]) {
							scope.formVariables[genericVariable.name].value = genericVariable.value;
							scope.formVariables[genericVariable.name].type = genericVariable.type;
						} else {
							scope.formVariables[genericVariable.name] = genericVariable;
						}
					}

					scope.submitForm();
				};
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

			};
	}]);

function isJSON (text) {
	try {
		JSON.parse(text);

		return true;
	} catch (e) {
		return false;
	}
}
