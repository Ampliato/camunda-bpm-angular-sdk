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

			controller: function ($scope, $element, camApi) {
				var container = angular.element($element.children()[0]);

				$scope.submitForm = function () {
					$scope._camForm.submit(function (error) {
						if (error) {
							throw error;
						}

						console.log("success!");
					})
				};

				function loadForm () {
					$scope._camForm = null;

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
						$scope._camForm = new CamSDK.Form({
							processDefinitionId:	$scope.processDefinition.id,
							taskId:					($scope.task ? $scope.task.id : null),
							containerElement:		container,
							client: 				camApi,
							formUrl: 				formUrl,
							initialized: function (error) {
								console.log("asdasd");
								var injector = container.injector();
								injector.invoke(['$compile', function($compile) {
									$compile(container)($scope);
								}]);
							}
						});
					} else {
						throw "ErRor";
					}
				}

				function loadTaskForm () {
					camApi.resource("").startForm(
						{id: ($scope.process ? $scope.process.id : $scope.processId)},

						function (error, result) {
							if (error) {
								throw error;
							}

							if (result.key) {
								$scope.formKey = result.key;
								$scope.formContextPath = result.contextPath;

								loadForm();
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

								loadForm();
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

	.directive("camFormVariable",
	function () {
		return {
			restrict: "A",

			scope: {},

			controller: function ($scope, $element) {

			}
		};
	});
