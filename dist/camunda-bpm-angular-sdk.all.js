'use strict';

angular.module("camBpmSdk", [])
	.value("HttpClient", CamSDK.Client)
	.value("CamForm", CamSDK.Form)
	.value("MockHttpClient", CamSDKMocks)

	.factory("camApiHttpClient", ["MockHttpClient", "$rootScope",
		function (MockHttpClient,   $rootScope) {
			function AngularClient (config) {
				var Client = (config.mock === true ? MockHttpClient : CamSDK.Client.HttpClient);
				this._wrapped = new Client(config);
			}

			angular.forEach(['post', 'get', 'load', 'put', 'del'], function(name) {
				AngularClient.prototype[name] = function(path, options) {
					if (!options.done) {
						return;
					}

					var original = options.done;

					options.done = function(err, result) {
						$rootScope.$apply(function() {
							original(err, result);
						});
					};

					this._wrapped[name](path, options);
				};
			});

			angular.forEach(['on', 'once', 'off', 'trigger'], function(name) {
				AngularClient.prototype[name] = function() {
					this._wrapped[name].apply(this, arguments);
				};
			});

			return AngularClient;
		}]
	)

	.provider('camApi', function () {
		var camApiConf = {
			apiUri:     'engine-rest/engine'
		};

		this.setApiConfiguration = function (configuration) {
			camApiConf = configuration;
		};

		this.$get = ['camApiHttpClient', function(camAPIHttpClient) {
			var conf = angular.copy(camApiConf);
			conf.HttpClient = camAPIHttpClient;

			return new CamSDK.Client(conf);
		}];
	});

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

			controller: ["$scope", "$element", "$compile", "camApi", function ($scope, $element, $compile, camApi) {
				var self = this;
				var container = angular.element($element.children()[0]);
				$scope.formVariables = {};

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

					// if (formUrl) {
					// 	camApi.http.load(formUrl, {
					// 		done: function (error, formHtmlSource) {
					// 			if (error) {
					// 				throw error;
					// 			}
					//
					// 			renderForm(formHtmlSource);
					// 		}
					// 	});
					//
					// } else {
						$scope.formScope.genericVariables = [];
						var formHtmlSource = "<cam-generic-form></cam-generic-form>";
						renderForm(formHtmlSource);
						// throw "ErRor";
					// }
				}

				function loadVariables () {
					$scope.formScope.variables = {};

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
			}],

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

				// Pass ngModel changes to 'formVariables' object.
				scope.$watch(function () {
					return ngModelController.$modelValue;
				}, function () {
					if (scope.formVariables[scope.variableName]) {
						scope.formVariables[scope.variableName].value =
							ngModelController.$modelValue;
					} else {
						scope.formVariables[scope.variableName] =
							{
								value: ngModelController.$modelValue,
								type: scope.variableType
							};
					}
				});
			}
		};
	})

	.directive("camGenericForm",
	function () {
		return {
			restrict: "AE",

			scope: true,

			require: ["^camForm"],

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
	});

angular.module("camBpmSdk").run(["$templateCache", function($templateCache) {$templateCache.put("directives/camForm/camForm.html","<div ng-form=\"variablesForm\" class=\"cam-form-container\"></div>\n");
$templateCache.put("directives/camForm/camGenericForm.html","<h3>Variables</h3>\n<div ng-repeat=\"variable in genericVariables\" class=\"row form-group\">\n	<div class=\"col-md-6\">\n		<input type=\"text\" ng-model=\"variable.name\" class=\"form-control\" placeholder=\"name\">\n	</div>\n	<div class=\"col-md-6\">\n		<input type=\"text\" ng-model=\"variable.value\" class=\"form-control\" placeholder=\"value\">\n	</div>\n</div>\n<button type=\"button\" class=\"btn btn-default\" ng-click=\"submitGenericForm()\">Submit Form</button>\n");}]);