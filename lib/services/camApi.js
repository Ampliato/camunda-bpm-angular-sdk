"use strict";

angular
	.module("camApi", [])
	.provider('camApi', function () {
		var camApiConf = {
			apiUri: "engine-rest"
		};

		this.setApiConfiguration = function (configuration) {
			camApiConf = configuration;
		};

		this.$get = ["$http", function($http) {

			var configuration = angular.copy(camApiConf);

			return new CamundaApi($http, configuration);
		}];
	});

function CamundaApi ($http, configuration) {
	this.$http = $http;
	this.configuration = configuration;

	if (!configuration.engine) {
		configuration.engine = "default";
	}

	configuration.baseUrl = configuration.apiUri;

	if(configuration.baseUrl.slice(-1) !== "/") {
		configuration.baseUrl += "/";
	}

	configuration.baseUrl = configuration.baseUrl + "engine/" + configuration.engine;
}

angular.forEach(['post', 'get', 'put', 'delete'], function(name) {
	CamundaApi.prototype[name] = function (path, configuration) {
		if (typeof path != 'string') {
			if (!configuration && path) {
				configuration = path;
			}

			path = "/";
		}

		if (path.slice(0, 1) !== "/") {
			path = "/" + path;
		}

		if (!configuration) {
			configuration = {};
		}

		configuration.method = name.toUpperCase();
		configuration.url = this.configuration.baseUrl + path;

		if (!configuration.headers) {
			configuration.headers = {};
		}

		if (!configuration.headers["Accept"]) {
			configuration.headers["Accept"] = "application/hal+json, application/json";
		}

		return this.$http(configuration);
	}
});

CamundaApi.prototype.resource = function (resourceName) {
	return new CamundaApiResource(this, resourceName);
};

function CamundaApiResource (camundaApi, resourceName) {
	this.camundaApi = camundaApi;
	this.resourceName = resourceName;
}

angular.forEach(['post', 'get', 'put', 'delete'], function(name) {
	CamundaApiResource.prototype[name] = function (path, configuration) {
		if (typeof path != 'string') {
			if (!configuration && path) {
				configuration = path;
			}

			path = "/";
		}

		if (path.slice(0, 1) !== "/") {
			path = "/" + path;
		}

		path = "/" + this.resourceName + path;

		return this.camundaApi[name](path, configuration);
	}
});

CamundaApiResource.prototype.list = function (params) {
	return this.get("", {
		params: params
	});
};
