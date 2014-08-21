'use strict';

angular
	.module("camForm", ["camBpmSdk"])
	.directive("camForm",
	function () {
		return {
			restrict: 'EA',

			scope: {
				processDefinition: "=",
				task: "=",
			},

			controller: function ($scope, $element, $compile, camApi) {
				var self = this;
				var container = angular.element($element.children()[0]);
				$scope.formVariables = {};

				this.setFormVariable = function (name, value, type) {
					$scope.formVariables[name] = {
						value: value,
						type: type
					};
				}

				this.getFormVariable = function (name) {
					return $scope.formVariables[name];
				}

				$scope.submitForm = function (done) {
					var data = {
						id: $scope.resourceId
					};

					data.variables = $scope.formVariables;

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
							done: function (error, result) {
								if (error) {
									throw error;
								}

								renderForm(result);
							}
						});

					} else {
						throw "ErRor";
					}
				}

				function loadVariables () {
					$scope.formScope.variables = {};

					camApi.resource($scope.resource).formVariables(
						{
							id : $scope.resourceId
						},
						function (error, variables) {
							if (error) {
								throw error;
							}

							for (var i in variables) {
								var variable = variables[i];
								$scope.formScope.variables[variable.id] = variable.value;
							}
						}
					);
				}

				function renderForm (formHtmlSource) {
					container.html("<div>" + formHtmlSource + "</div>");

					$compile(angular.element(container.children()[0]).contents())($scope.formScope);
				}

				function loadTaskForm () {
					$scope.resource = "task";
					$scope.resourceId = $scope.task.id;
				}

				function loadProcessStartForm () {
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

				$scope.$watch("processDefinition", function () {
					if ($scope.processDefinition) {
						loadProcessStartForm();
					}
				});

				$scope.$watch("task", function () {
					if ($scope.taskId) {
						loadTaskForm();
					}
				});
			},

			link: function (scope, element, attrs) {

			},

			templateUrl: "directives/camForm/camForm.html"
		};
	})

	.directive("camVariableName",
	function () {
		return {
			restrict: "A",

			scope: {
				"variableName": "@camVariableName",
				"variableType": "@camVariableType",
				"model": "=ngModel"
			},

			require: ["ngModel", "^camForm"],

			controller: function () {},

			link: function (scope, element, attrs, controllers) {
				var ngModelController = controllers[0];
				var camFormController = controllers[1];

				scope.$watch(function () {
					return ngModelController.$modelValue;
				}, function () {
					camFormController.setFormVariable(scope.variableName, ngModelController.$modelValue, scope.variableType);
				});
			}
		};
	});
