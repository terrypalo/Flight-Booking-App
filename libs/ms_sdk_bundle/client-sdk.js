(function (root, factory) {
    "use strict";

    if (typeof define === 'function' && define.amd) {
        define(['lodash', 'q', 'EventEmitter', 'localforage', 'moment', 'tv4', 'CryptoJS',
            requirejs.s.contexts._.config.paths.$Libs+"/ms_sdk_bundle/underscore-query/underscore-query.amd.min",
            requirejs.s.contexts._.config.paths.$Libs+"/ms_sdk_bundle/localforage/plugins/localforage-setitems/localforage-setitems",
            requirejs.s.contexts._.config.paths.$Libs+"/ms_sdk_bundle/localforage/plugins/localforage-find/localforage-find",
            requirejs.s.contexts._.config.paths.$Libs+"/ms_sdk_bundle/offline/offline"], function (_, Q, EventEmitter, localforage, moment, tv4, CryptoJS, UnderscoreQuery, LocalForageSetItemsPlugin, LocalForageFindPlugin, Offline){
            return factory(root, Q, EventEmitter, localforage, _, moment, tv4, CryptoJS, Offline);
        });
    } else {
        root.AppClient = factory(root, root.Q, root.EventEmitter, root.localforage, root._, root.moment, root.tv4, root.CryptoJS, root.Offline);
    }

}(this, function (root, Q, EventEmitter, localforage, _, moment, tv4, CryptoJS, Offline) {
    "use strict";

    //defining some functions for support underscore
    if(_.isUndefined(_.cloneDeep)){
        _.mixin({"cloneDeep": function(obj){
            return JSON.parse(JSON.stringify(obj));
        }});
    }

    if(_.isUndefined(_.endsWith)){
        _.mixin({"endsWith": function (string, pattern) {
            var d = string.length - pattern.length;
            return d >= 0 && string.indexOf(pattern, d) === d;
        }});
    }

    if(_.isUndefined(_.startsWith)){
        _.mixin({"startsWith": function (string, pattern) {
            return string.lastIndexOf(pattern, 0) === 0;
        }});
    }

    if(_.isUndefined(_.slice)){
        _.mixin({"slice": function (array, start, end) {
            return array.slice(start, end);
        }});
    }

    var console = root.console;

    var State = {};
    Object.defineProperties(State, {
        "INITIAL": {
            "enumerable": true,
            "value": "initial"
        },
        "OFFLINE": {
            "enumerable": true,
            "value": "offline"
        },
        "ONLINE": {
            "enumerable": true,
            "value": "online"
        },
        "SYNCHRONIZING": {
            "enumerable": true,
            "value": "synchronizing"
        },
        "SYNC_FAILED": {
            "enumerable": true,
            "value": "sync_failed"
        }
    });

    var AppClient = function () {
        _.bindAll(this, "init",
            "initOffline", "initOnline",
            "_initOnlineOperation","_initOfflineOperation",
            "_getStateOperationChain","_setStateOperationChain",
            "getModelListOffline", "getModelsMetaDataOnline",
            "initDAOOffline", "initDAOOnline", "setSessionToken",
            "login", "logout",
            "dao", "folder",
            "isOffline", "isOnline",
            "goOffline", "goOnline",
            "retrySync", "resetFailedSync",
            "_pushDeferredActionIntoQueue", "_executeDeferredActionsQueue",
            "_removeDeferredAction","_persistDeferredActionsQueue", "synchronize", "_persistUsersData",
            "invoke","post","get","_makeRequest","_getCustomModelsList",
            "_setCustomModelsList","initCustomModelsDAO",
            "setCustomModel", "removeCustomModel","getState",
            "getDeferredActions", "saveDeferredActions", "revertLocalChanges");

        this._stateStorageKey = null;
        this._deferredActionsStorageKey = null;
        this._modelListStorageKey = null;
        this._customModelsListStorageKey = null;
        this._currentUser = null;

        this.state = State.INITIAL;

        this.settings = {
            rest_api_version : "1",
            handleNetworkState : true,
            isDataValidationEnabled : true
        };

        this._daoMap = {};

        this._deferredActions = null;

        this._usersData = null;

        this._restRequestManager = new RestRequestManager();

        this._stateOperationChain = Q();
    };

    AppClient.prototype = _.clone(EventEmitter.prototype);

    AppClient.prototype.State = State;

    AppClient.prototype.init = function (settings) {
        if (!_.isUndefined(this.initPromise) && (this.initPromise.isPending() || (!this.initPromise.isPending() && !this.initPromise.isRejected()))) {
            // AppClient has already been initialized or initializing now
            return this.initPromise;
        }

        this.initPromise = Q.Promise(function (resolve, reject) {
            console.log("Client SDK: init");
            _.extend(this.settings, settings);

            if (!this.settings.domain) {
                throw new InitializationError("Required setting 'domain' is empty");
            }

            if (!this.settings.apiKey) {
                throw new InitializationError("Required setting 'apiKey' is empty");
            }

            if ((!_.isUndefined(this.settings.cacheTimeout) && !_.isNumber(this.settings.cacheTimeout)) || _.isNaN(this.settings.cacheTimeout)) {
                throw new InitializationError("Setting 'cacheTimeout' has invalid value");
            }

            var url = this.settings._url = {};
            this.settings.domain = this.settings.domain.trim();
            if(_.startsWith(this.settings.domain,"https://")){
                this.settings.domain = this.settings.domain.replace("https://","https://api.");
            }else if(_.startsWith(this.settings.domain,"http://")){
                this.settings.domain = this.settings.domain.replace("http://","http://api.");
            }else{
                this.settings.domain = "https://api." + this.settings.domain;
            }
            url.meta = this.settings.domain + "/rest/"+this.settings.rest_api_version+"/apiexpress/meta";
            url.rest = this.settings.domain + "/rest/"+this.settings.rest_api_version+"/apiexpress/api";
            url.security = this.settings.domain + "/rest/"+this.settings.rest_api_version+"/apiexpress/security";

            this._modelListStorageKey = "sdk-model-list";
            this._customModelsListStorageKey = "sdk-custom-models-list";
            this._deferredActionsStorageKey = "sdk-deferred-actions";
            this._stateStorageKey = "sdk-state";
            this._usersDataStorageKey = "sdk-users-data";
            this._localForageSettings = {
                "name": "ms:" + this.settings.domain + ":" + this.settings.apiKey
            };
            localforage.config(this._localForageSettings);
            resolve();

        }.bind(this))
            //loading cached users data
            .then(function () {
                return Q.Promise(function (resolve, reject) {
                    localforage.getItem(this._usersDataStorageKey, function (err, data) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(this._usersData = data || []);
                        }
                    }.bind(this));
                }.bind(this));
            }.bind(this))
            //loading deffered actions
            .then(function () {
                return Q.Promise(function (resolve, reject) {
                    localforage.getItem(this._deferredActionsStorageKey, function (err, actions) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(this._deferredActions = actions || []);
                        }
                    }.bind(this));
                }.bind(this));
            }.bind(this))
            //initializing request manager
            .then(function(){
                var restManagerInitoptions = {};
                restManagerInitoptions.cacheTimeout = this.settings.cacheTimeout;
                return this._restRequestManager.init(restManagerInitoptions);
            }.bind(this))
            .then(function () {
                if(this.settings.handleNetworkState){
                    //online/offline detection is enabled
                    //so we need to check internet status once right now
                    return Q.Promise(function (resolve, reject) {
                        //initializing Offline.js
                        Offline.options = {
                            checks: {
                                xhr: {
                                    //url for checking internet state
                                    //project meta url is used
                                    url: this.settings._url.meta + "/model?apiKey="+this.settings.apiKey || "key_not_provided"
                                }
                            }
                        };
                        Offline.on("confirmed-up", function() {
                            Offline.off("confirmed-up");
                            Offline.off("down");
                            resolve(State.ONLINE);
                        });
                        Offline.on("down", function() {
                            Offline.off("confirmed-up");
                            Offline.off("down");
                            resolve(State.OFFLINE);
                        });
                        //check Internet status
                        Offline.check();
                    }.bind(this)).then(function(networkState){
                        //apply new state
                        this.state = networkState;
                        return Q.Promise(function (resolve, reject) {
                            localforage.setItem(this._stateStorageKey, this.state, function (err, state) {
                                if (err) {
                                    reject(err);
                                } else {
                                    this.emit("statechange", state);
                                    resolve(state);
                                }
                            }.bind(this));
                        }.bind(this));
                    }.bind(this));
                }else {
                    //automatic online/offline detection is disabled
                    //loading previous sdk state or get current from settings
                    return Q.Promise(function (resolve, reject) {
                        localforage.getItem(this._stateStorageKey, function (err, state) {
                            if (err) {
                                reject(err);
                            } else {
                                var stateFromInitSettings = this.settings.currentState;
                                var restoredState = state;
                                var isNeedToStoreState = false;
                                //checking incoming state from settings
                                if (!_.isUndefined(stateFromInitSettings) && !_.isNull(stateFromInitSettings)
                                    && _.contains(_.values(State), stateFromInitSettings)
                                    && (stateFromInitSettings === State.ONLINE || stateFromInitSettings === State.OFFLINE)) {
                                    //checking restored state
                                    if (!_.isUndefined(restoredState) && !_.isNull(restoredState) &&
                                        _.contains(_.values(State), restoredState)
                                        && restoredState !== State.SYNC_FAILED
                                        && restoredState !== State.SYNCHRONIZING
                                        && restoredState !== stateFromInitSettings) {
                                        state = stateFromInitSettings;
                                        isNeedToStoreState = true;
                                    }
                                }
                                if (_.contains(_.values(State), state)) {
                                    this.state = state;
                                } else {
                                    this.state = State.ONLINE;
                                    isNeedToStoreState = true;
                                }
                                if (isNeedToStoreState) {
                                    localforage.setItem(this._stateStorageKey, this.state, function (err, state) {
                                        if (err) {
                                            reject(err);
                                        } else {
                                            this.emit("statechange", state);
                                            resolve(state);
                                        }
                                    }.bind(this));
                                } else {
                                    this.emit("statechange", state);
                                    resolve(state);
                                }
                            }
                        }.bind(this));
                    }.bind(this));
                }
            }.bind(this))
            //init online/offline, depends on sdk state
            .then(function () {
                var promise;
                if (this.isOffline()) {
                    promise = this.initOffline();
                } else {
                    promise = this.initOnline();
                }
                promise = promise['finally'](function(){
                    //activating network state change detection if needed
                    if(this.settings.handleNetworkState){
                        Offline.on("confirmed-up", function() {
                            this.goOnline();
                        }.bind(this));
                        Offline.on("down", function() {
                            this.goOffline();
                        }.bind(this));
                        if(!Offline.isListeningForNetworkChange()){
                            Offline.listen();
                        }
                    }
                }.bind(this));
                promise = promise.then(function () {
                    this.emit("init");
                }.bind(this));
                promise = promise['catch']((function (err) {
                    console.error(err);
                    return Q.reject(err);
                }).bind(this));
                promise = promise.then(function (){
                    return this;
                }.bind(this));
                return promise;
            }.bind(this));
        return this.initPromise;
    };

    AppClient.prototype._getStateOperationChain = function(){
        return this._stateOperationChain["catch"](function(){
        });
    };

    AppClient.prototype._setStateOperationChain = function(chain){
        return this._stateOperationChain = chain;
    };

    AppClient.prototype._addOperationToChain = function(operation){
        var operationsChain = this._getStateOperationChain();
        operationsChain = operationsChain.then(function(){
            return operation();
        });
        this._setStateOperationChain(operationsChain);
        return operationsChain;
    };

    AppClient.prototype.synchronize = function () {
        return Q.Promise(function (resolve, reject) {
            localforage.setItem(this._stateStorageKey, State.SYNCHRONIZING, function (err, state) {
                if (err) {
                    reject(err);
                } else {
                    this.state = state;
                    this.emit("statechange", state);
                    resolve();
                }
            }.bind(this));
        }.bind(this))
            .then(this._executeDeferredActionsQueue)
            .then(function () {
                return Q.Promise(function (resolve, reject) {
                    localforage.setItem(this._stateStorageKey, State.ONLINE, function (err, state) {
                        if (err) {
                            reject(err);
                        } else {
                            this.state = state;
                            this.emit("statechange", state);
                            resolve();
                        }
                    }.bind(this));
                }.bind(this));
            }.bind(this))
            ['catch'](function (err) {
            var outErr = err;
            console.error("Error going online: " + err);
            return Q.Promise(function (resolve, reject) {
                localforage.setItem(this._stateStorageKey, State.SYNC_FAILED, function (err, state) {
                    if (err) {
                        reject(err);
                    } else {
                        this.state = state;
                        this.emit("statechange", state);
                        reject(outErr);
                    }
                }.bind(this));
            }.bind(this));
        }.bind(this));
    };

    AppClient.prototype.initOnline = function () {
        return this._addOperationToChain(this._initOnlineOperation);
    };

    AppClient.prototype._initOnlineOperation = function () {
        return this.getModelsMetaDataOnline()
            .then(function (metadata) {
                this.settings.isProjectSecured = metadata.isSecurity;
                this._daoMap = {};
                return metadata.models;
            }.bind(this))

            .then(this.initDAOOnline)
            .then(this.initCustomModelsDAO)
            .then(function () {
                if (!this._isProjectSecured()) {
                    //project is not secured,start synchronize deferred actions
                    return this.synchronize();
                } else {
                    //project is secured, skip synchronize and just set state to ONLINE
                    return Q.Promise(function (resolve, reject) {
                        localforage.setItem(this._stateStorageKey, State.ONLINE, function (err, state) {
                            if (err) {
                                reject(err);
                            } else {
                                this.state = state;
                                this.emit("statechange", state);
                                resolve();
                            }
                        }.bind(this));
                    }.bind(this));
                }
            }.bind(this));
    };

    AppClient.prototype._isProjectSecured = function (){
        return this.settings.isProjectSecured;
    }

    AppClient.prototype.initOffline = function (){
        return this._addOperationToChain(this._initOfflineOperation);
    };

    AppClient.prototype._initOfflineOperation = function () {
        return this.getModelListOffline()
            .then(function (models) {
                this._daoMap = {};
                return models;
            }.bind(this))
            .then(this.initDAOOffline)
            .then(this.initCustomModelsDAO);
    };

    AppClient.prototype.isOffline = function () {
        return this.state === State.OFFLINE;
    };

    AppClient.prototype.isOnline = function () {
        return this.state === State.ONLINE;
    };

    AppClient.prototype.isInitialized = function () {
        return this.state !== State.INITIAL;
    };

    AppClient.prototype.goOffline = function () {
        if (this.state !== State.ONLINE) {
            console.warn("AppClient can go offline state from online state only. Current SDK State: " + this.state);
            return Q();
        }
        var promise = this.initOffline();
        promise = promise.then(function(){
            return Q.Promise(function (resolve, reject) {
                localforage.setItem(this._stateStorageKey, State.OFFLINE, function (err, state) {
                    if (err) {
                        reject(err);
                    } else {
                        this.state = state;
                        this.emit("statechange", state);
                        resolve(state);
                    }
                }.bind(this));
            }.bind(this));
        }.bind(this));
        return promise;
    };

    AppClient.prototype.goOnline = function () {
        if (this.state !== State.OFFLINE) {
            console.warn("AppClient can go online state from offline state only. Current SDK State: " + this.state);
            return Q();
        }

        var promise = this.initOnline();
        if (this._currentUser !== null && this._currentUser instanceof UserData) {
            promise = promise.then(function () {
                console.log("goOnline: Login user");
                return this.login(this._currentUser.userName, this._currentUser.password);
            }.bind(this));
            promise = promise.then(this.synchronize);
        }
        return promise;
    };

    AppClient.prototype.retrySync = function () {
        if (this.state === State.INITIAL) {
            return Q.reject("SDK is not initialized yet");
        }
        if (this.state !== State.SYNC_FAILED) {
            console.warn("AppClient can retry synchronization being in failed sync state only");
            return Q();
        }
        this.state = State.OFFLINE;
        return this.goOnline()
            ['catch'](function (err) {
            this.state = State.SYNC_FAILED;
            return Q.reject(err);
        }.bind(this));
    };

    AppClient.prototype.resetFailedSync = function () {
        if (this.state === State.INITIAL) {
            return Q.reject("SDK is not initialized yet");
        }
        if (this.state !== State.SYNC_FAILED) {
            console.warn("AppClient can perform reset operation being in failed sync state only");
            return Q();
        }
        this.state = State.OFFLINE;
        var modelsForPurgeList = _.chain(this._deferredActions)
            .pluck("modelName")
            .uniq();
        return Q.Promise(function (resolve, reject) {
            localforage.removeItem(this._deferredActionsStorageKey, function (err) {
                if (err) {
                    reject(err);
                } else {
                    this._deferredActions = [];
                    resolve();
                }
            }.bind(this));
        }.bind(this))
            .then(this.goOnline)
            .then(function () {
                var purgeCachePromises = modelsForPurgeList.map(function (modelName) {
                    return this.dao(modelName).store.purge();
                }.bind(this)).value();
                return Q.all(purgeCachePromises);
            }.bind(this))
            ['catch'](function (err) {
            this.state = State.SYNC_FAILED;
            return Q.reject(err);
        }.bind(this));
    };

    AppClient.prototype.revertLocalChanges = function () {
        if (this.state === State.INITIAL) {
            return Q.reject("SDK is not initialized yet");
        }
        return this._addOperationToChain(function () {
            return Q.fcall(function(){
                var promise = Q();
                for (var i = this._deferredActions.length - 1; i > -1; i--) {
                    var action = this._deferredActions[i];
                    promise = promise.then(_.partial(this.dao(action.modelName)._revertDeferredActionChanges, action));
                    promise = promise.then(function(){
                        this._deferredActions.pop();
                        return this.saveDeferredActions();
                    }.bind(this));
                }
                return promise;
            }.bind(this));
        }.bind(this));
    };

    AppClient.prototype.getState = function () {
        return Q(this.state);
    };

    AppClient.prototype._getCustomModelsList = function () {
        return Q.Promise(function (resolve, reject) {
            localforage.getItem(this._customModelsListStorageKey, function (err, value) {
                console.log("Getting custom models list");
                if (err) {
                    reject(err);
                } else {
                    resolve(value || []);
                }
            }.bind(this));
        }.bind(this));
    };

    AppClient.prototype._setCustomModelsList = function (customModelsList) {
        if(!_.isUndefined(customModelsList) &&!_.isNull(customModelsList) && _.isArray(customModelsList)) {
            var promise;
            if(!_.isEmpty(customModelsList)) {
                promise = Q(localforage.setItem(this._customModelsListStorageKey, customModelsList));
            }else{
                promise = Q(localforage.removeItem(this._customModelsListStorageKey));
            }
        }else{
            promise = Q.reject("Invalid models list");
        }
        return promise;
    };

    AppClient.prototype.getModelListOffline = function () {
        return Q.Promise(function (resolve, reject) {
            localforage.getItem(this._modelListStorageKey, function (err, value) {
                console.log("Getting model list offline");
                if (err) {
                    reject(err);
                } else {
                    resolve(value || []);
                }
            }.bind(this));
        }.bind(this));
    };

    AppClient.prototype.getModelsMetaDataOnline = function () {
        console.log("Getting model list online");
        return this.ajax("GET", this.settings._url.meta + "/model").then(function (metaData) {
            return Q.Promise(function (resolve, reject) {
                localforage.setItem(this._modelListStorageKey, metaData.models, function (err, value) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(metaData);
                    }
                }.bind(this));
            }.bind(this));
        }.bind(this));
    };

    AppClient.prototype.initCustomModelsDAO = function () {
        return this._getCustomModelsList().then(function(customModelsList){
            return this.initDAOOffline(customModelsList, true);
        }.bind(this));
    };

    AppClient.prototype.initDAOOnline = function (modelName) {
        if (_.isArray(modelName)) {
            console.log("Initializing DAO list online: " + JSON.stringify(modelName));
            var promises = [];
            for (var i = 0, j = modelName.length; i < j; i++) {
                promises[i] = this.initDAOOnline(modelName[i]);
            }
            return Q.all(promises);
        } else {
            console.log("Initializing DAO online: " + JSON.stringify(modelName));
            return this.ajax("GET", this.settings._url.meta + "/model/" + modelName)
                .then((function (modelMetadata) {
                    var dao = this._daoMap[modelName] = new EntityDAO(this, modelName, modelMetadata);
                    return dao.init();
                }).bind(this));
        }
    };

    AppClient.prototype.initDAOOffline = function (modelName, isCustomModel) {
        if (_.isArray(modelName)) {
            console.log("Initializing DAO list offline: " + JSON.stringify(modelName));
            var promises = [];
            for (var i = 0, j = modelName.length; i < j; i++) {
                promises[i] = this.initDAOOffline(modelName[i], isCustomModel);
            }
            return Q.all(promises);
        } else {
            console.log("Initializing DAO offline: " + JSON.stringify(modelName));
            var dao = this._daoMap[modelName] = new EntityDAO(this, modelName, undefined, isCustomModel);
            return dao.init();
        }
    };

    AppClient.prototype.setSessionToken = function (token) {
        if (this.state === State.INITIAL) {
            return Q.reject("SDK is not initialized yet");
        }
        var tokenWrapper = {};
        tokenWrapper.token = token;
        if (_.isUndefined(tokenWrapper.token) || _.isNull(tokenWrapper.token)) {
            return Q.reject("Incorrect session token");
        }
        if (!_.isString(tokenWrapper.token)) {
            return Q.reject("Session token should be a String");
        }
        if (_.isEmpty(tokenWrapper.token)) {
            return Q.reject("Session token cannot be empty");
        }
        this.settings.headers = this.settings.headers || {};
        this.settings.headers["X-Appery-Session-Token"] = tokenWrapper.token;
        return Q(tokenWrapper.token);
    };

    AppClient.prototype.login = function (username, password) {
        if (this.state === State.INITIAL) {
            return Q.reject("SDK is not initialized yet");
        }

        if (!username) {
            return Q.reject("'username' is empty");
        }

        if (!password) {
            return Q.reject("'password' is empty");
        }

        if (this.isOffline()) {
            return Q.fcall(function () {
                return Q.Promise(function (resolve, reject) {
                    if (_.findIndex(this._usersData, new UserData(username, password)) !== -1) {
                        //offline login success
                        this._currentUser = new UserData(username, password, true);
                        resolve();
                    } else {
                        reject("Invalid username or password");
                    }
                }.bind(this));
            }.bind(this))
                ['catch'](function (err) {
                console.error(err);
                return Q.reject(err);
            }.bind(this));
        } else {

            var options = {};
            options.headers = {};
            options.headers["Content-Type"] = "application/json";
            options.data = {
                "username": username,
                "password": password
            };

            return this.ajax("POST", this.settings._url.security + "/login", options)
                .then(function (tokenObj) {
                    this.settings.headers = this.settings.headers || {};
                    this.settings.headers["X-Appery-Session-Token"] = tokenObj.sessionToken;
                    this._usersData = [];
                    this._usersData.push(new UserData(username, password));
                    this._currentUser = new UserData(username, password, true);
                }.bind(this))
                .then(this._persistUsersData)
                ['catch'](function (err) {
                console.error(err);
                return Q.reject(err);
            }.bind(this));
        }

    };

    AppClient.prototype.logout = function () {

        if (this.state === State.INITIAL) {
            return Q.reject("SDK is not initialized yet");
        }

        if (this._currentUser === null) {
            return Q.reject("You are not logged in");
        }

        if (this.isOffline()) {
            this._currentUser = null;
            return Q.resolve();
        } else {
            var token = this.settings.headers && this.settings.headers["X-Appery-Session-Token"];

            if (!token) {
                return Q.reject("You are not logged in");
            }

            var options = {};
            options.headers = {};
            options.headers["Content-Type"] = "application/json";
            options.data = {
                "token": token
            };

            return this.ajax("POST", this.settings._url.security + "/logout", options)
                .then(function () {
                    if (this.settings.headers) {
                        delete this.settings.headers["X-Appery-Session-Token"];
                    }
                    this._currentUser = null;
                }.bind(this))
                ['catch'](function (err) {
                console.error(err);
                return Q.reject(err);
            }.bind(this));
        }
    };

    AppClient.prototype.dao = function (modelName) {
        if (this.state === State.INITIAL) {
            throw new Error("SDK is not initialized yet");
        }

        if (!modelName) {
            throw new Error("Can't get DAO for empty model name");
        }

        if (Object.keys(this._daoMap).length === 0) {
            throw new Error("No model has been initialized yet");
        }

        var dao = this._daoMap[modelName];

        if (!dao) {
            throw new Error("Model '" + modelName + "' not found");
        }

        return dao;
    };

    AppClient.prototype.folder = function (basePath) {
        return {
            "dao": function (modelName) {
                var path = basePath + "/" + modelName;
                while (path.indexOf("//") !== -1) {
                    path = path.replace("//", "/");
                }
                return this.dao(path);
            }.bind(this)
        };
    };

    AppClient.prototype.invoke = function (method, path, options, cached) {
        if (this.state === State.INITIAL) {
            return Q.reject("SDK is not initialized yet");
        }
        var requestBaseURL = this.settings._url.rest;
        options = options || {};
        options.headers = options.headers || {};
        _.defaults(options.headers, this.settings.headers, options.headers);

        if(_.isUndefined(path) || _.isNull(path)){
            return Q.reject("Invoke 'path' param is empty");
        }

        if(!_.isString(path)){
            return Q.reject("Incorrect type for invoke 'path' param");
        }

        if(_.isEmpty(path)){
            return Q.reject("Invoke 'path' param is empty");
        }

        if(method !== 'GET' && method !== 'POST'&& method !== 'PUT' && method !== 'DELETE'){
            return Q.reject("Incorrect request method");
        }

        if(method === 'POST' || method === 'PUT'){
            options.headers = options.headers || {};
            options.headers["Content-Type"] = options.headers["Content-Type"] || "application/json";
        }

        if(!_.endsWith(requestBaseURL,"/") && !_.startsWith(path,"/")){
            requestBaseURL = requestBaseURL + "/";
        }

        requestBaseURL = requestBaseURL + path;

        if(_.indexOf(requestBaseURL,"?") != -1){
            requestBaseURL = requestBaseURL + '&apiKey='+this.settings.apiKey || "key_not_provided";
        }else{
            requestBaseURL = requestBaseURL + '?apiKey='+this.settings.apiKey || "key_not_provided";
        }

        return this._makeRequest(method, requestBaseURL, options, cached);
    };

    AppClient.prototype.get = function(url, options, cached){
        return this._makeRequest("GET", url, options, cached);
    };

    AppClient.prototype.post = function(url, options, cached){
        return this._makeRequest("POST", url, options, cached);
    };

    AppClient.prototype._makeRequest = function(method, url, options, cached){
        if (this.state === State.INITIAL) {
            return Q.reject("SDK is not initialized yet");
        }
        cached = cached || false;
        options = options || {};
        if(this.isOffline() || cached){
            return this._restRequestManager.getCachedResponce(method, url, options);
        }else{
            return this._restRequestManager.getResponce(method, url, options);
        }
    };

    AppClient.prototype.ajax = function (method, url, options) {
        return Q.Promise(function (resolve, reject) {
            options = options || {};
            options = _.cloneDeep(options);

            options.headers = options.headers || {};

            _.defaults(options.headers, this.settings.headers, options.headers);

            var query = {
            };

            options.skipApiKey = options.skipApiKey || false;
            if(!options.skipApiKey) {
                query["apiKey"]= this.settings.apiKey || "key_not_provided";
            }

            if (!_.isEmpty(options.data) && method === 'GET') {
                query = _.defaults(query, options.data);
            }

            if(_.indexOf(url,"?") != -1){
                url = url + '&';
            }else{
                url = url + '?';
            }

            url = url + this._objectToQueryString(query);

            var http = new XMLHttpRequest();

            http.open(method, url, true);

            http.onload = function () {
                // status 200 OK, 201 CREATED, 20* ALL OK
                if (http.status.toString().substr(0, 2) === '20') {
                    if (options.isDetailedAjaxResponceNeeded) {
                        try {
                            resolve(new AjaxDetailResponce(JSON.parse(http.responseText), http));
                        } catch (e) {
                            resolve(new AjaxDetailResponce(http.response, http));
                        }
                    } else {
                        try {
                            resolve(JSON.parse(http.responseText));
                        } catch (e) {
                            resolve(http.response);
                        }
                    }
                } else {
                    var httpResponse = http.responseText;
                    var httpErrorResponseObject = httpResponse;
                    if (options.isDetailedAjaxErrorResponceNeeded){
                        var responseObj = {};
                        responseObj.httpStatus = http.status;
                        responseObj.statusText = http.statusText;
                        try {
                            responseObj.response = JSON.parse(httpResponse);
                        } catch (e) {
                            responseObj.response = httpResponse;
                        }
                        try {
                            responseObj.responseHeaders = {};
                            //parsing responce headers
                            var headerPairs = http.getAllResponseHeaders().split('\u000d\u000a');
                            for (var i = 0, len = headerPairs.length; i < len; i++) {
                                var headerPair = headerPairs[i];
                                var index = headerPair.indexOf('\u003a\u0020');
                                if (index > 0) {
                                    var key = headerPair.substring(0, index);
                                    var val = headerPair.substring(index + 2);
                                    responseObj.responseHeaders[key] = val;
                                }
                            }
                        }catch(ex){
                            responseObj.responseHeaders = {};
                        }
                        httpErrorResponseObject = responseObj;
                    }
                    reject(httpErrorResponseObject);
                }
            };
            http.onerror = function () {
                reject(new Error('Unable to send request to ' + JSON.stringify(url)));
            };

            if (!_.isEmpty(options.headers)) {
                _.each(options.headers, function (value, key) {
                    http.setRequestHeader(key, value);
                });
            }

            if (_.isObject(options.data)) {
                options.data = JSON.stringify(options.data);
            }

            http.send(method === 'GET' ? null : options.data);
        }.bind(this));
    };

    AppClient.prototype._buildAjaxOptions = function (initialOptions) {
        var options = {};

        options.headers = {};
        _.defaults(options.headers, initialOptions.headers);

        if (initialOptions.data) {
            options.data = initialOptions.data;
        }

        if (initialOptions.contentType) {
            options.headers["Content-Type"] = initialOptions.contentType;
        }

        return options;
    };

    AppClient.prototype._objectToQueryString = function (obj) {
        if (!_.isObject(obj)) {
            return obj;
        }
        var pairs = [];
        _.each(obj, function (value, key) {
            pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(_.isObject(value) ? JSON.stringify(value) : value));
        });
        return pairs.join('&');
    };

    AppClient.prototype._pushDeferredActionIntoQueue = function (action) {
        return Q.fcall(function () {
            this._deferredActions.push(_.cloneDeep(action));
            return this._persistDeferredActionsQueue();
        }.bind(this));
    };

    AppClient.prototype.getDeferredActions = function(){
        if (this.state === State.INITIAL) {
            return Q.reject("SDK is not initialized yet");
        }
        var index = -1;
        return Q({
            next: function(){
                index++;
                if (index < this._deferredActions.length) {
                    var deferredAction = this._deferredActions[index];
                    var defferedActionData = {
                        modelName: deferredAction.modelName,
                        operation: deferredAction.operation,
                        content:   deferredAction.content,
                    };
                    if(!_.isUndefined(deferredAction.httpErrorResponse)){
                        defferedActionData.httpErrorResponse = deferredAction.httpErrorResponse;
                    }
                    return {
                        done: false,
                        value: defferedActionData
                    };
                } else {
                    return {
                        done: true
                    };
                }
            }.bind(this),
            remove: function(){
                if (index !== -1 && index < this._deferredActions.length) {
                    this._deferredActions.splice(index--, 1);
                }else{
                    throw new Error("Out of range");
                }
            }.bind(this)
        });
    }

    AppClient.prototype.saveDeferredActions = function(){
        if (this.state === State.INITIAL) {
            return Q.reject("SDK is not initialized yet");
        }
        return this._persistDeferredActionsQueue();
    }

    AppClient.prototype._getDeferredActionsForModel = function (modelName) {
        var actionsForModel = [];
        for (var i = 0; i < this._deferredActions.length; i++) {
            var action = this._deferredActions[i];
            if (action.modelName === modelName) {
                actionsForModel.push(action);
            }
        }
        return actionsForModel;
    };

    AppClient.prototype._removeDeferredAction = function (action) {
        var promise = Q();
        promise = promise.then(function () {
            this._deferredActions = _.without(this._deferredActions, action);
            return this.saveDeferredActions();
        }.bind(this));
        return promise;
    };

    AppClient.prototype._persistDeferredActionsQueue = function () {
        return Q(localforage.setItem(this._deferredActionsStorageKey, this._deferredActions));
    };

    AppClient.prototype._persistUsersData = function () {
        return Q(localforage.setItem(this._usersDataStorageKey, this._usersData));
    };

    AppClient.prototype._executeDeferredActionsQueue = function () {
        if (!this._deferredActions || this._deferredActions.length === 0) {
            return Q();
        }
        var promise = Q();
        //filtering deferred action from previous errors before start
        _.map(this._deferredActions, function(item){
            delete item.httpErrorResponse;
            return item;
        });
        for (var i = 0; i < this._deferredActions.length; i++) {
            var action = this._deferredActions[i];
            action.requestOptions.options = action.requestOptions.options || {};
            action.requestOptions.options.isDetailedAjaxErrorResponceNeeded = true;
            promise = promise.then(_.partial(this.dao(action.modelName)._performDeferredAction, action));
            promise = promise.then(function (deferredResultData) {
                this._deferredActions.shift();
                if (deferredResultData instanceof DeferredActionResultData) {
                    var isNeedToUpdateId = deferredResultData.oldId != deferredResultData.newId;
                    _.forEach(this._deferredActions, function (deferredAction) {
                        var deferredActionData = deferredAction.content.data;
                        //update id if needed
                        if(isNeedToUpdateId){
                            //check if action url contains old entity id
                            if (_.contains(deferredAction.requestOptions.url, deferredResultData.oldId)) {
                                deferredAction.requestOptions.url = deferredAction.requestOptions.url.replace(deferredResultData.oldId, deferredResultData.newId);
                            }
                            //replacing other deferred linked actions with new id
                            if (!_.isUndefined(deferredActionData)) {
                                var filterData = function(data){
                                    _.forEach(data, function (value, key) {
                                        if(_.isObject(value)){
                                            filterData(value);
                                        }else if (value === deferredResultData.oldId) {
                                            data[key] = deferredResultData.newId;
                                        }
                                    });
                                };
                                filterData(deferredActionData);
                            }
                        }
                        //update modifiedAt
                        if(deferredAction.modelName === deferredResultData.modelName  && !_.isUndefined(deferredResultData.modifiedAt)
                            && (deferredAction.operation === ENTITY_DAO_OPERATION.UPDATE || deferredAction.operation === ENTITY_DAO_OPERATION.DELETE)){
                            //then this operation requires modifiedAt value to be updated
                            deferredAction.requestOptions.options.headers["X-Appery-Entity-Modified-At"] = deferredResultData.modifiedAt;
                        }
                    });
                }
                return this.saveDeferredActions();
            }.bind(this));
        }
        promise = promise['catch'](function(deferredActionExecutionError){
            var action = deferredActionExecutionError.action;
            action.httpErrorResponse = deferredActionExecutionError.error;
            return Q.reject(_.cloneDeep(deferredActionExecutionError.error.response));
        }.bind(this));
        return promise;
    };

    AppClient.prototype.clearCache = function (options) {
        if (this.state === State.INITIAL) {
            return Q.reject("SDK is not initialized yet");
        }
        var promise = Q();
        options = options || {};
        if(!_.isEmpty(options)) {
            options = _.cloneDeep(options);
        }
        if(!_.isUndefined(options.modelName)){
            //clearing cache for specific model
            promise = promise.then(function(){
                return this.dao(options.modelName);
            }.bind(this)).then(function(modelDao){
                if(_.isUndefined(options.id) || _.isNull(options.id)) {
                    //removing all cached items
                    return modelDao.store.purge();
                }else{
                    //removing specified items
                    if(_.isObject(options.id) && !_.isArray(options.id)){
                        throw new Error("Id has invalid type");
                    }
                    if(_.isArray(options.id)){
                        _.each(options.id, function(key){
                            if (_.isObject(key)) {
                                throw new Error("Id must be a primitive");
                            }
                            modelDao.store.evict(key);
                        });
                    }else{
                        modelDao.store.evict(options.id);
                    }
                }
            });
        }else{
            //clearing all cache for all models
            promise = promise.then(function(){
                var purgeCachePromises = _.values(this._daoMap).map(function (dao) {
                    return dao.store.purge();
                }.bind(this));
                return Q.all(purgeCachePromises);
            }.bind(this));
        }
        promise = promise.then(function(){});
        return promise;
    };

    /*Creates custom model from provided metadata and returns DAO object*/
    AppClient.prototype.setCustomModel = function (modelMetadata) {
        if (this.state === State.INITIAL) {
            return Q.reject("SDK is not initialized yet");
        }
        return Q.fcall(function() {
            //validating model metadata
            if (EntityDAO._isModelMetadataValid(modelMetadata)) {
                //update custom models list with new model name
                return this._getCustomModelsList().then(function(customModelsList){
                    if(!_.contains(customModelsList, modelMetadata.modelName)) {
                        customModelsList.push(modelMetadata.modelName);
                        return this._setCustomModelsList(customModelsList);
                    }
                }.bind(this)).then(function(){
                    //initialize dao for new models
                    var dao = this._daoMap[modelMetadata.modelName] = new EntityDAO(this, modelMetadata.modelName, modelMetadata, true);
                    return dao.init();
                }.bind(this));
            } else {
                throw new Error("Invalid model metadata");
            }
        }.bind(this));
    };

    AppClient.prototype.removeCustomModel = function(modelName) {
        if (this.state === State.INITIAL) {
            return Q.reject("SDK is not initialized yet");
        }
        return Q.fcall(function(){
            //clear model data
            this.dao(modelName).store.purge();
            //remove model medatada from storage
            return Q.Promise(function (resolve, reject) {
                localforage.removeItem(this.dao(modelName)._metaStorageKey, function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            }.bind(this));
        }.bind(this))
            .then(function(){
                //remove model DAO object
                delete this._daoMap[modelName];
                return this._getCustomModelsList();
            }.bind(this))
            .then(function(customModelsList){
                //remove model name from custom models list
                return this._setCustomModelsList(_.without(customModelsList,modelName));
            }.bind(this));
    };

//Detailed ajax response
    function AjaxDetailResponce(responceData, httpRequest) {
        this.data = responceData;
        this.httpRequest = httpRequest;
    }

//Data type for deferred create action result
    function DeferredActionResultData(modelName, oldId, newId, modifiedAt) {
        this.modelName = modelName;
        this.oldId = oldId;
        this.newId = newId;
        this.modifiedAt = modifiedAt;
    }

//User data
    function UserData(username, password, storePass) {
        this.userName = username;
        this.secret = CryptoJS.MD5(password);
        if (!_.isUndefined(storePass) && storePass) {
            this.password = password;
        }
    }


// Initialization Error
    function InitializationError(message) {
        this.name = 'InitializationError';
        this.message = message || 'Error occurred during Client SDK initialization';
    }

    InitializationError.prototype = new Error();
    InitializationError.prototype.constructor = InitializationError;


// Initialization Error

    function ValidationError(message) {
        this.name = 'ValidationError';
        this.message = message || 'Error occurred during Client SDK initialization';
    }

    ValidationError.prototype = new Error();
    ValidationError.prototype.constructor = ValidationError;

//Adding format validators

    tv4.addFormat('date', function (data, schema) {
        var dateFormats = [
            'YYYYMMDD',
            'YYYY-MM-DD',
            'YYYY-MM',
            'YYYY',
            'YY',
            'YYYYDDD',
            'YYYY-DDD',
            'YYYY[W]wwD',
            'YYYY-[W]ww-D',
            'YYYY[W]ww',
            'YYYY-[W]ww'
        ];
        if (moment(data, dateFormats, true).isValid()) {
            return null;
        }
        return 'A valid ISO 8601 date format expected';
    });

    tv4.addFormat("date-time", function (data, schema) {
        var dateTimeFormats = [
            'YYYYMMDDTHHmmss',
            'YYYYMMDDTHHmmssZ',
            'YYYYMMDDTHHmmss+HHmm',
            'YYYYMMDDTHHmmss-HHmm',
            'YYYYMMDDTHHmmss+HH',
            'YYYYMMDDTHHmmss-HH',
            'YYYY-MM-DDTHH:mm:ss',
            'YYYY-MM-DDTHH:mm:ssZ',
            'YYYY-MM-DDTHH:mm:ss+HH:mm',
            'YYYY-MM-DDTHH:mm:ss-HH:mm',
            'YYYY-MM-DDTHH:mm:ss+HH',
            'YYYY-MM-DDTHH:mm:ss-HH',
            'YYYYMMDDTHHmm',
            'YYYY-MM-DDTHH:mm',
            'YYYYDDDTHHmmZ',
            'YYYY-DDDTHH:mmZ',
            'YYYY[W]wwDTHHmm+HHmm',
            'YYYY[W]wwDTHHmm-HHmm',
            'YYYY-[W]ww-DTHH:mm+HH',
            'YYYY-[W]ww-DTHH:mm-HH',
            'YYYY-MM-DDTHH:mm:ss.SSSS',
            'YYYYMMDD HHmmss',
            'YYYYMMDD HHmmssZ',
            'YYYYMMDD HHmmss+HHmm',
            'YYYYMMDD HHmmss-HHmm',
            'YYYYMMDD HHmmss+HH',
            'YYYYMMDD HHmmss-HH',
            'YYYY-MM-DD HH:mm:ss',
            'YYYY-MM-DD HH:mm:ssZ',
            'YYYY-MM-DD HH:mm:ss+HH:mm',
            'YYYY-MM-DD HH:mm:ss-HH:mm',
            'YYYY-MM-DD HH:mm:ss+HH',
            'YYYY-MM-DD HH:mm:ss-HH',
            'YYYYMMDD HHmm',
            'YYYY-MM-DD HH:mm',
            'YYYYDDD HHmmZ',
            'YYYY-DDD HH:mmZ',
            'YYYY[W]wwD HHmm+HHmm',
            'YYYY[W]wwD HHmm-HHmm',
            'YYYY-[W]ww-D HH:mm+HH',
            'YYYY-[W]ww-D HH:mm-HH',
            'YYYY-MM-DD HH:mm:ss.SSSS',
            'YYYY-MM-DD HH:mm:ss.SSS'
        ];
        if (moment(data, dateTimeFormats, true).isValid()) {
            return null;
        }
        return 'A valid ISO 8601 date/time string expected';
    });

    tv4.addFormat('time', function (data, schema) {
        var timeFormats = [
            'HHmmss',
            'HH:mm:ss',
            'HHmm',
            'HH:mm',
            'HH',
            'HHmmss.ss',
            'HH:mm:ss.ss',
            'HHmm.mm',
            'HH:mm.mm',
            'HHmmssZ',
            'HHmmZ',
            'HHZ',
            'HH:mm:ssZ',
            'HH:mmZ',
            'HHmmss+HHmm',
            'HHmmss-HHmm',
            'HHmmss+HH',
            'HHmmss-HH',
            'HH:mm:ss+HH:mm',
            'HH:mm:ss-HH:mm',
            'HH:mm:ss+HH',
            'HH:mm:ss-HH'
        ];
        if (moment(data, timeFormats, true).isValid()) {
            return null;
        }
        return 'A valid ISO 8601 time string expected';
    });

// Entity DAO

    var MODEL_SYNC_TYPE = {};
    Object.defineProperties(MODEL_SYNC_TYPE, {
        "ONE_WAY": {
            "enumerable": true,
            "value": "ONE_WAY"
        },
        "TWO_WAY": {
            "enumerable": true,
            "value": "TWO_WAY"
        }
    });

    var ENTITY_DAO_OPERATION = {};
    Object.defineProperties(ENTITY_DAO_OPERATION, {
        "CREATE": {
            "enumerable": true,
            "value": "CREATE"
        },
        "READ": {
            "enumerable": true,
            "value": "READ"
        },
        "UPDATE": {
            "enumerable": true,
            "value": "UPDATE"
        },
        "DELETE": {
            "enumerable": true,
            "value": "DELETE"
        },
        "FIND": {
            "enumerable": true,
            "value": "FIND"
        },
        "COUNT": {
            "enumerable": true,
            "value": "COUNT"
        }
    });

    var EntityDAO = function (sdkInstance, modelName, modelMetadata, isCustomModel) {
        _.bindAll(this, "init", "create", "get", "update", "delete", "find", "validate", "_deferAction", "_performDeferredAction", "_revertDeferredActionChanges");
        this.sdk = sdkInstance;
        this.modelName = modelName;
        this.meta = modelMetadata;
        this.isCustomModel = isCustomModel || false;
        this._metaStorageKey = "model-meta:" + modelName;
        this.store = new EntityStorage(this);
    };

    EntityDAO._isModelMetadataValid = function (modelMetadata) {
        var modelMetadataFormat = {
            "type": "object",
            "properties": {
                "modelName": {
                    "type": ["string"]
                },
                "modelSyncType": {
                    "type": ["string"]
                },
                "deletedAttribute": {
                    "type": ["string"]
                },
                "modifiedAtAttribute": {
                    "type": ["string"]
                },
                "schema": {
                    "type": ["object"]
                },
                "idAttribute": {
                    "type": ["string"]
                },
                "api": {
                    "type": ["object"]
                }
            },
            "required": ["modelName", "schema", "idAttribute", "api", "modelSyncType", "deletedAttribute", "modifiedAtAttribute"]
        };
        return  tv4.validate(modelMetadata, modelMetadataFormat);
    };

    EntityDAO.prototype.init = function () {
        return Q.Promise(function (resolve, reject) {
            if (this.meta) {
                localforage.setItem(this._metaStorageKey, this.meta, function (err, value) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this);
                    }
                }.bind(this));
            } else {
                localforage.getItem(this._metaStorageKey, function (err, value) {
                    if (err) {
                        reject(err);
                    } else {
                        if (value) {
                            this.meta = value;
                            resolve(this);
                        } else {
                            reject("No offline metadata for model " + this.modelName);
                        }
                    }
                }.bind(this));
            }
        }.bind(this));
    };

    EntityDAO.prototype._deferAction = function (operation, data, revertedData, method, url, options) {
        if(!_.isUndefined(options.data)){
            options = _.omit(options, "data");
        }
        return this.sdk._pushDeferredActionIntoQueue({
            modelName: this.modelName,
            operation: operation,
            content:{
                data: data,
                revertedData: revertedData
            },
            requestOptions:{
                method: method,
                url: url,
                options: options
            }
        });
    };

    EntityDAO.prototype._performDeferredAction = function (action) {
        var promise;
        var ajaxOptions = {
            method: action.requestOptions.method,
            url: action.requestOptions.url
        };
        ajaxOptions.options = action.requestOptions.options || {};
        if(!_.isUndefined(action.content.data)){
            ajaxOptions.options.data = _.cloneDeep(action.content.data);
        }
        if (action.operation === ENTITY_DAO_OPERATION.CREATE) {
            var modelId = ajaxOptions.options.data[this.meta.idAttribute];
            if(_.isString(modelId) && modelId.indexOf("__tmp_entity_id__") !== -1) {
                // Create with auto generated primary key
                delete ajaxOptions.options.data[this.meta.idAttribute];
                promise = this.sdk.ajax(ajaxOptions.method, ajaxOptions.url, ajaxOptions.options)
                    .then(function (data) {
                        return this.store.get(modelId).then(function(storedItem){
                            var innerPromise = Q();
                            if(!_.isNull(storedItem)){
                                storedItem[this.meta.idAttribute] = data[this.meta.idAttribute];
                                innerPromise = innerPromise.then(function(){
                                    return this.store.set(storedItem);
                                }.bind(this));
                            }
                            innerPromise = innerPromise.then(function () {
                                if(this._isTwoWaySyncActivated()) {
                                    return new DeferredActionResultData(this.modelName, modelId, data[this.meta.idAttribute], this._getMofidiedAt(data));
                                }else{
                                    return new DeferredActionResultData(this.modelName, modelId, data[this.meta.idAttribute]);
                                }
                            }.bind(this));
                            return innerPromise
                        }.bind(this));
                    }.bind(this))
                    ['finally'](function () {
                    this.store.evict(modelId);
                }.bind(this));
            }
        }else if(action.operation === ENTITY_DAO_OPERATION.UPDATE){
            promise = this.sdk.ajax(ajaxOptions.method, ajaxOptions.url, ajaxOptions.options)
                .then(function(data) {
                    if(this._isTwoWaySyncActivated()) {
                        return new DeferredActionResultData(this.modelName, data[this.meta.idAttribute], data[this.meta.idAttribute], this._getMofidiedAt(data));
                    }
                }.bind(this))
        }
        if(_.isUndefined(promise)) {
            // All other cases
            promise = this.sdk.ajax(ajaxOptions.method, ajaxOptions.url, ajaxOptions.options);
        }
        promise = promise['catch'](function(error){
            var defferredActionExecutionError = {
                action: action,
                error: error
            }
            return Q.reject(defferredActionExecutionError);
        });
        return promise;
    };

    EntityDAO.prototype._revertDeferredActionChanges = function (action) {
        console.log("[EntityDAO] Reverting operation "+action.operation);
        switch (action.operation){
            case ENTITY_DAO_OPERATION.CREATE:
                var modelId = action.content.data[this.meta.idAttribute];
                return this.store.evict(modelId);
            case ENTITY_DAO_OPERATION.UPDATE:
                var modelId = action.content.revertedData[this.meta.idAttribute];
                return this.store.get(modelId).then(function(storedItem){
                    if(!_.isNull(storedItem)){
                        return this.store.evict(modelId).then(function(){
                            return this.store.set(action.content.revertedData)
                        }.bind(this));
                    }
                }.bind(this));
            case ENTITY_DAO_OPERATION.DELETE:
                var modelId = action.content.revertedData[this.meta.idAttribute];
                return this.store.set(action.content.revertedData)
        }
    }

    EntityDAO.prototype.create = function (content, options) {
        if (!this.meta.api.create || !this.meta.api.create.url) {
            return Q.reject("Action 'create' is not supported by model " + this.modelName);
        }

        options = options || {};

        try {
            this.validate(content);
        } catch (e) {
            return Q.reject(e);
        }

        content = _.cloneDeep(content);
        options = _.cloneDeep(options);
        options.data = content;
        options.contentType = options.contentType || "application/json";
        options = this.sdk._buildAjaxOptions(options);
        options.skipApiKey = this.isCustomModel;

        var urlParams = {};
        var url = this._processURL(this.meta.api.create.url, urlParams);

        if (this.sdk.isOffline()) {
            var promise = Q();
            var id = options.data[this.meta.idAttribute];
            if (!_.isUndefined(id) && !_.isNull(id)) {
                promise = promise.then(function(){
                    return this.store.get(id).then(function(storedItem){
                        if(!_.isNull(storedItem)){
                            return Q.reject("Entity with id " + id + " already exists");
                        }
                    });
                }.bind(this));
            } else {
                // ID is auto generated on the server
                // Creating temporary id's that will be replaced with real one after synchronization
                options.data[this.meta.idAttribute] = "__tmp_entity_id__" + (Math.floor(Math.random() * 1e6 - 1) + 1e6);
            }
            promise = promise.then(function(){
                return this._deferAction(ENTITY_DAO_OPERATION.CREATE, options.data, null, "POST", url, options).then(function () {
                    return this.store.set(options.data).then(function(){
                        return options.data;
                    });
                }.bind(this));
            }.bind(this));
            return promise;
        } else {
            return this.sdk.ajax("POST", url, options).then(function (obj) {
                try {
                    return this.store.set(obj).then(function(){
                        return obj;
                    });
                } catch (e) {
                    return Q.reject(e.message);
                }
            }.bind(this));
        }
    };

    EntityDAO.prototype.get = function (id, options) {
        options = options || {};
        options.cached = options.cached || false;
        if (!this.meta.api.get || !this.meta.api.get.url) {
            return Q.reject("Action 'get' is not supported by model " + this.modelName);
        }

        if (_.isUndefined(id) || _.isNull(id)) {
            return Q.reject("Can't perform 'get' on " + this.modelName + ", object ID is empty");
        }

        if (!_.isUndefined(options.cached)) {
            if (!_.isBoolean(options.cached)) {
                return Q.reject("Invalid cached option type. Should be a boolean.");
            }
        }

        if (this.sdk.isOffline() || options.cached === true) {
            return this.store.get(id).then(function(storedItem){
                if(!_.isNull(storedItem)){
                    return storedItem;
                }else{
                    return Q.reject("Entity with id " + id + " not found in storage");
                }
            });

        } else {
            options = this.sdk._buildAjaxOptions(options);
            options.skipApiKey = this.isCustomModel;
            var urlParams = {}, idURLParam = {};
            idURLParam[this.meta.idAttribute] = id;
            _.defaults(urlParams, this.sdk.urlParams, idURLParam);
            var url = this._processURL(this.meta.api.get.url, urlParams);

            return this.sdk.ajax("GET", url, options).then(function (obj) {
                try {
                    return this.store.set(obj).then(function(){
                        return obj;
                    });
                } catch (e) {
                    return Q.reject(e.message);
                }
            }.bind(this));
        }
    };

    EntityDAO.prototype.update = function (id, content, options) {
        if (!this.meta.api.update || !this.meta.api.update.url) {
            return Q.reject("Action 'update' is not supported by model " + this.modelName);
        }

        if (_.isUndefined(id) || _.isNull(id)) {
            return Q.reject("Can't update entity by empty id");
        }

        try {
            this.validate(content);
        } catch (e) {
            return Q.reject(e);
        }

        options = options || {};
        content = _.cloneDeep(content);
        options = _.cloneDeep(options);
        options.headers = options.headers || {};
        options.data = _.omit(content, this.meta.idAttribute);
        options.contentType = options.contentType || "application/json";

        if (_.isEmpty(options.data)) {
            return Q.reject("Can't update entity with nothing");
        }

        var promise = Q();
        if(this._isTwoWaySyncActivated()){
            promise = this.store.get(id);
            promise = promise.then(function(storedItem){
                if(!_.isNull(storedItem)){
                    this._setEntityAtHeaders(ENTITY_DAO_OPERATION.UPDATE, storedItem, options.headers);
                }
            }.bind(this));
        }
        promise = promise.then(function(){
            options = this.sdk._buildAjaxOptions(options);
            options.skipApiKey = this.isCustomModel;
            var urlParams = {};
            urlParams[this.meta.idAttribute] = id;
            var url = this._processURL(this.meta.api.update.url, urlParams);

            if (this.sdk.isOffline()) {
                return this.store.get(id).then(function(storedItem){
                    if (!_.isNull(storedItem)) {
                        return this._deferAction(ENTITY_DAO_OPERATION.UPDATE, options.data, storedItem, "PUT", url, options).then(function () {
                            return this.store.evict(id).then(function(){
                                var updatedItem = _.extend(storedItem, options.data);
                                return this.store.set(updatedItem).then(function(){
                                    return updatedItem;
                                });
                            }.bind(this));
                        }.bind(this));
                    } else {
                        return Q.reject("Entity with id " + id + " not found");
                    }
                }.bind(this));
            } else {
                return this.sdk.ajax("PUT", url, options).then(function (obj) {
                    try {
                        //removing old object
                        var promise = this.store.evict(id);
                        //add updated object
                        promise = promise.then(function(){
                            return this.store.set(obj);
                        }.bind(this));
                        //returning update result
                        promise = promise.then(function(){
                            return obj;
                        });
                        return promise;
                    } catch (e) {
                        return Q.reject(e.message);
                    }
                }.bind(this));
            }
        }.bind(this));
        return promise;
    };

    EntityDAO.prototype['delete'] = function (id, options) {
        if (!this.meta.api['delete'] || !this.meta.api['delete'].url) {
            return Q.reject("Action 'delete' is not supported by model " + this.modelName);
        }
        if (_.isUndefined(id) || _.isNull(id)) {
            return Q.reject("Can't perform 'delete' on " + this.modelName + ", object ID is empty");
        }
        options = options || {};
        options = _.cloneDeep(options);
        options.headers = options.headers || {};
        var urlParams = {}, idURLParam = {};
        idURLParam[this.meta.idAttribute] = id;
        _.defaults(urlParams, this.sdk.urlParams, idURLParam);
        var url = this._processURL(this.meta.api['delete'].url, urlParams);

        var promise = Q();
        if(this._isTwoWaySyncActivated()){
            promise = this.store.get(id);
            promise = promise.then(function(storedItem){
                if(!_.isNull(storedItem)){
                    this._setEntityAtHeaders(ENTITY_DAO_OPERATION.DELETE, storedItem, options.headers);
                }
            }.bind(this));
        }
        promise = promise.then(function(){
            options = this.sdk._buildAjaxOptions(options);
            options.skipApiKey = this.isCustomModel;
            if (this.sdk.isOffline()) {
                return this.store.get(id).then(function(storedItem){
                    if(!_.isNull(storedItem)){
                        return this._deferAction(ENTITY_DAO_OPERATION.DELETE, null, storedItem, "DELETE", url, options).then(function () {
                            return this.store.evict(id).then(function(){
                                return storedItem;
                            });
                        }.bind(this));
                    }else{
                        return Q.reject("Entity with id " + id + " not found");
                    }
                }.bind(this));
            } else {
                return this.sdk.ajax("DELETE", url, options).then(function (data) {
                    try {
                        return this.store.evict(id).then(function(){
                            return data;
                        });
                    } catch (e) {
                        return Q.reject(e.message);
                    }
                }.bind(this));
            }
        }.bind(this));
        return promise;
    };

    EntityDAO.prototype.getCount = function (where, options) {
        if (!this.meta.api.find || !this.meta.api.find.url) {
            return Q.reject("Action 'find' is not supported by model " + this.modelName);
        }
        where = where || {};
        options = options || {};
        options.cached = options.cached || false;

        var requestData = {
            "where": where,
            "count": true
        };

        var result = {};

        if (!_.isUndefined(options.cached)) {
            if (!_.isBoolean(options.cached)) {
                return Q.reject("Invalid cached option type. Should be a boolean.");
            }
        }

        if (this.sdk.isOffline()  || options.cached === true) {
            return this.store.count(requestData.where).then(function(storedItemsCount){
                result.count = storedItemsCount;
                return result;
            });
        } else {
            var urlParams = {};

            var url = this._processURL(this.meta.api.find.url, urlParams);

            options = this.sdk._buildAjaxOptions(options);
            options.skipApiKey = this.isCustomModel;

            options.data = requestData;

            options.isDetailedAjaxResponceNeeded = true;

            return this.sdk.ajax("GET", url, options).then(function (detailedResponce) {
                var promise = Q();
                try {
                    promise = promise.then(function () {
                        result.count = detailedResponce.httpRequest.getResponseHeader("X-Total-Count");
                        if (_.isUndefined(result.count) || _.isNull(result.count)) {
                            return Q.reject("Error getting count from server. Server returned empty count value.");
                        }
                        try {
                            result.count = parseInt(result.count);
                        } catch (ex) {
                            return Q.reject("Error getting count from server. Server returned invalid count value.");
                        }
                        return Q(result);
                    }.bind(this));
                } catch (e) {
                    promise.reject(e.message);
                }

                return promise;
            }.bind(this));
        }

    };

    EntityDAO.prototype.find = function (where, options) {
        if (!this.meta.api.find || !this.meta.api.find.url) {
            return Q.reject("Action 'find' is not supported by model " + this.modelName);
        }
        var DEFAULT_OFFSET = 0;
        var DEAFAULT_LIMIT = 100;
        var MAX_LIMIT = 1000;
        var requestData = {};
        options = options || {};
        options.cached = options.cached || false;
        requestData.where = where || {};
        requestData.offset = DEFAULT_OFFSET;
        requestData.limit = DEAFAULT_LIMIT;

        if (!_.isUndefined(options.offset)) {
            if (!(options.offset - 0) == options.offset && !_.isEmpty(options.offset)) {
                return Q.reject("Invalid offset option type. Should be a number.");
            }
            if (options.offset < 0) {
                return Q.reject("Invalid offset option value. Should not be negative.");
            }
            requestData.offset = options.offset;
        }

        if (!_.isUndefined(options.limit)) {
            if (!(options.limit - 0) == options.limit && !_.isEmpty(options.limit)) {
                return Q.reject("Invalid limit option type. Should be a number.");
            }
            if (options.limit < 0) {
                return Q.reject("Invalid limit option value. Should not be negative.");
            }
            requestData.limit = options.limit < MAX_LIMIT ? options.limit : MAX_LIMIT;
        }

        if (!_.isUndefined(options.cached)) {
            if (!_.isBoolean(options.cached)) {
                return Q.reject("Invalid cached option type. Should be a boolean.");
            }
        }

        if (this.sdk.isOffline() || options.cached === true) {
            return this.store.find(requestData.where, _.omit(requestData,"where"));
        } else {
            var urlParams = {};
            var url = this._processURL(this.meta.api.find.url, urlParams);

            options = this.sdk._buildAjaxOptions(options);
            options.skipApiKey = this.isCustomModel;

            options.data = requestData;
            return this.sdk.ajax("GET", url, options).then(function (data) {
                var promise = Q();

                try {
                    promise = promise.then(function () {
                        return this.store.set(data).then(function(){
                            return data;
                        });
                    }.bind(this));
                } catch (e) {
                    promise.reject(e.message);
                }

                return promise;
            }.bind(this));
        }
    };

    EntityDAO.prototype.validate = function (data) {
        if(!this.sdk.settings.isDataValidationEnabled){
            return;
        }
        if (!data) {
            throw new ValidationError("'data' is empty");
        }

        if (this.sdk.isOffline()) {
            var propetiesWithTempId = [];

            _.pick(data, function (value, key) {
                if (_.isString(value) && value.indexOf("__tmp_entity_id__") !== -1) {
                    propetiesWithTempId.push(key);
                }
            });

            var validationResult = tv4.validateMultiple(data, this.meta.schema, false, true);

            if (!validationResult.valid) {

                for (var i = 0; i < validationResult.errors.length; i++) {
                    var error = validationResult.errors[i];
                    var errorMessage;
                    errorMessage = error.message;
                    if (error.dataPath) {
                        var errorPropertyKey = error.dataPath.replace("/", "");
                        if (_.indexOf(propetiesWithTempId, errorPropertyKey) !== -1) {
                            continue;
                        } else {
                            errorMessage += ". Data Path: " + error.dataPath;
                            throw new ValidationError(errorMessage);
                        }
                    }

                }
            }
        } else {
            if (!tv4.validate(data, this.meta.schema, false, true)) {
                var error = tv4.error.message;
                if (tv4.error.dataPath) {
                    error += ". Data Path: " + tv4.error.dataPath;
                }
                throw new ValidationError(error);
            }
        }
    };

    EntityDAO.prototype._processURL = function (baseURL, parameters) {
        // TODO process URL - convert relative to absolute ones
        try {
            return baseURL.replace(/\{([^{}"':]+?)}/g, function (str, param) {
                if (!_.isUndefined(parameters[param]) && !_.isNull((parameters[param]))) {
                    return parameters[param];
                } else {
                    return str;
                }
            });
        } catch (e) {
            console.error("URL parameters substitution error: " + e.message);
            return baseURL;
        }
    };

    EntityDAO.prototype._isTwoWaySyncActivated = function(){
        return !_.isUndefined(this.meta.modelSyncType) && this.meta.modelSyncType === MODEL_SYNC_TYPE.TWO_WAY;
    };

    EntityDAO.prototype._getMofidiedAt = function(entity){
        if(this._isTwoWaySyncActivated()){
            var mofifiedAt = null;
            if(!_.isUndefined(this.meta.modifiedAtAttribute) && _.isString(this.meta.modifiedAtAttribute)){
                mofifiedAt = entity[this.meta.modifiedAtAttribute];
            }
            return mofifiedAt;
        }else{
            throw new Error("Can not get 'ModifiedAt' for model with ONE_WAY sync");
        }
    };

    EntityDAO.prototype._setMofidiedAt = function(entity, modifiedAt){
        entity[this.meta.modifiedAtAttribute] = modifiedAt;
    }

    EntityDAO.prototype._setEntityAtHeaders = function(operation, entity, headers){
        //checking if TWO_WAY synchronization activated
        if(this._isTwoWaySyncActivated()){
            //add mofifiedAt header
            headers["X-Appery-Entity-Modified-At"] = this._getMofidiedAt(entity);
        }
    };


// Entity storage

    var EntityStorage = function (dao) {
        _.bindAll(this, "set", "get", "evict", "find", "purge", "_loadCache", "_persistCache");
        this.dao = dao;
        this._dataStorageKey = "model_data_"+CryptoJS.enc.Hex.stringify(CryptoJS.MD5(this.dao.modelName));
        var storageSettings = _.extend(dao.sdk._localForageSettings,{storeName: this._dataStorageKey});
        this.localForageInst = localforage.createInstance(storageSettings);
    };

    EntityStorage.prototype = _.clone(EventEmitter.prototype);

    EntityStorage.prototype.set = function (data) {
        if (_.isString(data)) {
            try {
                data = JSON.parse(data);
            } catch (e) {
                return new Error("'data' in not a valid JSON");
            }
        }else{
            data = _.cloneDeep(data);
        }
        if(_.isArray(data)){
            return Q(this.localForageInst.setItems(data, function(item){
                //function should return key
                var key = item[this.dao.meta.idAttribute];
                if (typeof key !== 'string') {
                    key = String(key);
                }
                return key;
            }.bind(this), function(item){
                //function should return value
                return item;
            }.bind(this)));
        }else{
            return Q(this.localForageInst.setItem(data[this.dao.meta.idAttribute], data));
        }
    };

    EntityStorage.prototype.get = function (key) {
        if (key === undefined) {
            return undefined;
        } else if (_.isObject(key)) {
            throw new Error("Key must be a primitive");
        } else {
            return Q(this.localForageInst.getItem(key));
        }
    };

    EntityStorage.prototype.evict = function (key) {
        if (_.isObject(key)) {
            throw new Error("Key must be a primitive");
        } else {
            return Q(this.localForageInst.removeItem(key));
        }
    };

    EntityStorage.prototype.find = function (where, options) {
        options = options || {};
        var filterContext = {
            where: where || {},
            findOptions:{
                offset: options.offset,
                limit: options.limit
            },
            proccessedFindOptions:{
                offset: options.offset,
                limit: options.limit
            },
            proccessedObjects:{
                accepted: 0,
                rejected: 0
            },
            isOffsetWithCriteriaMode: false
        };

        if (!_.isObject(filterContext.where)) {
            throw new Error("Invalid query");
        };

        if(!_.isEmpty(filterContext.where) && (!_.isUndefined(filterContext.findOptions.offset) && filterContext.findOptions.offset > 0)){
            filterContext.proccessedFindOptions.offset = 0;
            filterContext.isOffsetWithCriteriaMode = true;
        }

        var promise = Q(this.localForageInst.find(function(key, value){
            if(_.isEmpty(where)){
                return true;
            }else {
                if(!filterContext.isOffsetWithCriteriaMode) {
                    return _.query([value], where).length > 0;
                }else{
                    var isObjectAccepted = _.query([value], where).length > 0;
                    if(isObjectAccepted){
                        filterContext.proccessedObjects.accepted++;
                        isObjectAccepted = filterContext.proccessedObjects.accepted >= filterContext.findOptions.offset;
                    }else{
                        filterContext.proccessedObjects.rejected++;
                    }
                    return isObjectAccepted;
                }
            }
        }.bind(filterContext), filterContext.proccessedFindOptions));
        return promise;
    };

    EntityStorage.prototype.count = function (where) {
        where = where || {};
        if (!_.isObject(where)) {
            throw new Error("Invalid query");
        };
        if(_.isEmpty(where)){
            return Q(this.localForageInst.length());
        }else{
            var counter = 0;
            var promise = Q(this.localForageInst.find(function(key, value){
                if(_.query([value], where).length > 0){
                    counter++;
                }
                return false;
            }));
            promise = promise.then(function(){
                return counter;
            });
            return promise;
        }

    };

    EntityStorage.prototype.purge = function () {
        return Q(this.localForageInst.clear());
    };

    EntityStorage.prototype._persistCache = function () {
        throw new Error("_persistCache not supported");
    };

    EntityStorage.prototype._loadCache = function () {
        throw new Error("_loadCache not supported");
    };

    //SDK Request Manager
    var RestRequestManager = function () {
        _.bindAll(this, "init", "_loadCache", "_persistCache", "_cleanUpCache", "_cacheRequest", "_buildCacheKeyForRequest", "_validateRequestParams",
            "_objectToQueryString", "_buildRequestOptions", "_parseResponseHeaders", "_send", "getResponce", "getCachedResponce");
        this.options = {
            cacheTimeout : 43200000
        };
        this._storageKey = "sdk-rest-cache";
        this._emitChange = _.debounce(function () {
            this.emit("change");
        }, 150);
        this.on("change", this._persistCache);
    };

    RestRequestManager.prototype = _.clone(EventEmitter.prototype);

    RestRequestManager.prototype.init = function(initOptions){
        if(!_.isUndefined(initOptions) && _.isObject(initOptions)){
            if(!_.isUndefined(initOptions.cacheTimeout) && _.isNumber(initOptions.cacheTimeout)){
                this.options.cacheTimeout = initOptions.cacheTimeout * 1000;
            }
        }
        return this._loadCache();
    };

    RestRequestManager.prototype._loadCache = function () {
        return Q.Promise(function (resolve, reject) {
            localforage.getItem(this._storageKey, function (err, value) {
                if (err) {
                    console.error(err);
                    reject(err);
                } else {
                    this._store = value || {};
                    resolve(value);
                }
            }.bind(this));
        }.bind(this));
    };

    RestRequestManager.prototype._persistCache = function () {
        return Q.Promise(function (resolve, reject) {
            localforage.setItem(this._storageKey, this._store, function (err, value) {
                if (err) {
                    console.error(err);
                    reject(err);
                } else {
                    resolve(value);
                }
            }.bind(this));
        }.bind(this));
    };

    RestRequestManager.prototype._cleanUpCache = function(){
        var createdAtExpiredTime = Date.now() - this.options.cacheTimeout;
        var expiredCacheItems = _.query(this._store,{createdAt: {"$lte":createdAtExpiredTime}});
        if(expiredCacheItems.length > 0) {
            _.each(expiredCacheItems, function (expiredCacheItem) {
                delete this._store[expiredCacheItem.cacheKey];
            }.bind(this));
            this._emitChange();
        }
    };

    RestRequestManager.prototype._cacheRequest = function(request_options, response){
        return Q.fcall(this._cleanUpCache).then(function(){
            var cacheKey = this._buildCacheKeyForRequest(request_options);
            var cacheItem = {};
            cacheItem.cachedResponce = _.cloneDeep(response);
            cacheItem.createdAt = Date.now();
            cacheItem.cacheKey = cacheKey;
            cacheItem.request = request_options;
            //save new data to cache or update exist
            this._store[cacheKey] = cacheItem;
            this._emitChange();
        }.bind(this));
    };

    RestRequestManager.prototype._buildCacheKeyForRequest = function (request_options) {
        var cacheRequestKey = null;
        request_options.headers = _.omit(request_options.headers,"X-Appery-Session-Token");
        cacheRequestKey = request_options.url + JSON.stringify(request_options.headers);
        if(request_options.method === "POST"){
            if(!_.isUndefined(request_options.data) && !_.isEmpty(request_options.data)) {
                if(_.isObject(request_options.data)){
                    cacheRequestKey = cacheRequestKey + JSON.stringify(request_options.data);
                }else{
                    cacheRequestKey = cacheRequestKey + request_options.data;
                }
            }
        }
        cacheRequestKey = CryptoJS.enc.Hex.stringify(CryptoJS.MD5(cacheRequestKey));
        return cacheRequestKey;
    };

    RestRequestManager.prototype._validateRequestParams = function(method, url, options){
        if(_.isUndefined(method) || _.isNull(method)){
            throw new ValidationError("method param is empty");
        }
        if(!_.isString(method)){
            throw new ValidationError("Incorrect 'method' param type");
        }
        if(_.isEmpty(method)){
            throw new ValidationError("method param is empty");
        }
        if(_.isUndefined(url) || _.isNull(url)){
            throw new ValidationError("url param is empty");
        }
        if(!_.isString(url)){
            throw new ValidationError("Incorrect 'url' param type");
        }
        if(_.isEmpty(url)){
            throw new ValidationError("url param is empty");
        }
    };

    RestRequestManager.prototype._objectToQueryString = function (obj) {
        if (!_.isObject(obj)) {
            return obj;
        }
        var pairs = [];
        _.each(obj, function (value, key) {
            pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(_.isObject(value) ? JSON.stringify(value) : value));
        });
        return pairs.join('&');
    };

    RestRequestManager.prototype._buildRequestOptions = function(method, url, initialOptions) {
        var options = _.cloneDeep(initialOptions);
        options.headers = options.headers || {};
        //process path params
        if(!_.isUndefined(options.pathParams) && _.isObject(options.pathParams)){
            _.each(options.pathParams, function (value, key) {
                var regexPatternString = "{"+key+"}";
                var replacePathParamPattern = new RegExp(regexPatternString,"g");
                url = url.replace(replacePathParamPattern, value);
            });
        }
        //process query params
        if(!_.isUndefined(options.queryParams) && _.isObject(options.queryParams)){
            if(_.indexOf(url,"?") != -1){
                url = url + '&';
            }else{
                url = url + '?';
            }
            url = url + this._objectToQueryString(options.queryParams);
        }

        if (!_.isEmpty(options.data) && method === 'GET') {
            if(_.indexOf(url,"?") != -1){
                url = url + '&';
            }else{
                url = url + '?';
            }
            url = url + this._objectToQueryString(options.data);
            delete options.data;
        }
        return {
            method: method,
            url : url,
            headers: options.headers,
            data : options.data || {}
        };
    };

    RestRequestManager.prototype._parseResponseHeaders = function(headerStr) {
        var headers = {};
        if (!headerStr) {
            return headers;
        }
        var headerPairs = headerStr.split('\u000d\u000a');
        for (var i = 0, len = headerPairs.length; i < len; i++) {
            var headerPair = headerPairs[i];
            var index = headerPair.indexOf('\u003a\u0020');
            if (index > 0) {
                var key = headerPair.substring(0, index);
                var val = headerPair.substring(index + 2);
                headers[key] = val;
            }
        }
        return headers;
    };

    RestRequestManager.prototype._send = function(request_options){
        return Q.Promise(function (resolve, reject) {
            var http = new XMLHttpRequest();
            http.open(request_options.method, request_options.url, true);
            http.onreadystatechange = function () {
                if (http.readyState == 4) {
                    // status 200 OK, 201 CREATED, 20* ALL OK
                    var responseObj = {};
                    responseObj.httpStatus = http.status;
                    responseObj.statusText = http.statusText;
                    try {
                        responseObj.response = JSON.parse(http.responseText);
                    } catch (e) {
                        responseObj.response = http.response;
                    }
                    try {
                        responseObj.responseHeaders = this._parseResponseHeaders(http.getAllResponseHeaders());
                    }catch(ex){
                        responseObj.responseHeaders = [];
                    }
                    if (http.status.toString().substr(0, 2) === '20') {
                        resolve(responseObj);
                    } else {
                        reject(responseObj);
                    }
                }
            }.bind(this);
            if (!_.isEmpty(request_options.headers)) {
                _.each(request_options.headers, function (value, key) {
                    http.setRequestHeader(key, value);
                });
            }
            if (!_.isUndefined(request_options.data) && !_.isEmpty(request_options.data)
                && (request_options.method === "POST" || request_options.method === "PUT")) {
                if(_.isObject(request_options.data)) {
                    request_options.data = JSON.stringify(request_options.data);
                }
                http.send(request_options.data);
            }else{
                http.send(null);
            }
        }.bind(this));
    };

    RestRequestManager.prototype.getResponce = function(method, url, options){
        return Q.fcall(function(){
            this._validateRequestParams(method, url, options);
        }.bind(this))
            .then(function(){
                var request_options = this._buildRequestOptions(method, url, options);
                return this._send(request_options)
                    .then(function(responseObj){
                        return this._cacheRequest(request_options, responseObj).then(function(){
                            return responseObj;
                        });
                    }.bind(this),function(responseObj){
                        return this._cacheRequest(request_options, responseObj).then(function(){
                            return Q.reject(responseObj);
                        });
                    }.bind(this));
            }.bind(this));
    };

    RestRequestManager.prototype.getCachedResponce = function(method, url, options){
        return Q.fcall(function(){
            this._validateRequestParams(method, url, options);
        }.bind(this))
            .then(function(){
                var request_options = this._buildRequestOptions(method, url, options);
                var cacheKey = this._buildCacheKeyForRequest(request_options);
                var cachedItem = this._store[cacheKey];
                if (!_.isUndefined(cachedItem) && _.isObject(cachedItem)) {
                    var cachedResponse = _.cloneDeep(cachedItem.cachedResponce);
                    if (cachedResponse.httpStatus.toString().substr(0, 2) === '20') {
                        return cachedResponse;
                    }else{
                        return Q.reject(cachedResponse);
                    }
                } else {
                    return Q.reject({
                        httpStatus: null,
                        statusText: "net::ERR_INTERNET_DISCONNECTED",
                        response: null,
                        responseHeaders: null
                    });
                }
            }.bind(this));
    };

    // For now exposed AppClient is a singleton, but this approach may change in future
    return new AppClient();
}));
