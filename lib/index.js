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
