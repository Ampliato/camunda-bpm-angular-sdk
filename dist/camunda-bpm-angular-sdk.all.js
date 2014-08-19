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

angular.module("camBpmSdk").run(["$templateCache", function($templateCache) {$templateCache.put("directives/camForm/camForm.html","<div class=\"cam-form-container\"></div>\n<button ng-click=\"submitForm()\">Submeter</button>\n");}]);
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

			controller: ["$scope", "$element", "camApi", function ($scope, $element, camApi) {
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
			}],

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

			controller: ["$scope", "$element", function ($scope, $element) {

			}]
		};
	});
