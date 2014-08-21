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

					camApi.http.get($scope.resource + "/" + $scope.resourceId + "/form-variables",
						{
							done : function (error, variables) {
								if (error) {
									throw error;
								}

								console.log(variables);

								for (var i in variables) {
									var variable = variables[i];
									$scope.formScope.variables[variable.name] = variable.value;
								}
							}
						});
				}

				function renderForm (formHtmlSource) {
					container.html("<div>" + formHtmlSource + "</div>");

					$compile(angular.element(container.children()[0]).contents())($scope.formScope);
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
				var camFormController = controllers[1];

				scope.$watch(function () {
					return ngModelController.$modelValue;
				}, function () {
					camFormController.setFormVariable(scope.variableName, ngModelController.$modelValue, scope.variableType);
				});
			}
		};
	});

angular.module("camBpmSdk").run(["$templateCache", function($templateCache) {$templateCache.put("directives/camForm/camForm.html","<div ng-form=\"variablesForm\" class=\"cam-form-container\"></div>\n");}]);