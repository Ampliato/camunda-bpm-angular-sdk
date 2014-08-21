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
					var data = {};
					var resource;
					if ($scope.processDefinition) {
						data.id = $scope.processDefinition.id;
						resource = "process-definition";
					} else {
						data.id = $scope.task.id;
						resource = "task";
					}

					data.variables = $scope.formVariables;

					camApi.resource(resource).submitForm(data,
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

				function renderForm (formHtmlSource) {
					container.html("<div>" + formHtmlSource + "</div>");

					$compile(angular.element(container.children()[0]).contents())($scope);
				}

				function loadTaskForm () {
					camApi.resource("task").startForm(
						{id: $scope.task.id},

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

				function loadProcessStartForm () {
					camApi.resource("process-definition").startForm(
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
						loadProcessStartForm();
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
