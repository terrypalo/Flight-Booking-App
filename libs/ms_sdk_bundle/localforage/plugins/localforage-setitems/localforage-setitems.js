(function() {
    'use strict';

    // Promises!
    var Promise = (typeof module !== 'undefined' && module.exports) ?
                  require('promise') : this.Promise;

    var globalObject = this;
    var serializer = null;

    var ModuleType = {
        DEFINE: 1,
        EXPORT: 2,
        WINDOW: 3
    };

    // Attaching to window (i.e. no module loader) is the assumed,
    // simple default.
    var moduleType = ModuleType.WINDOW;

    // Find out what kind of module setup we have; if none, we'll just attach
    // localForage to the main window.
    if (typeof define === 'function' && define.amd) {
        moduleType = ModuleType.DEFINE;
    } else if (typeof module !== 'undefined' && module.exports) {
        moduleType = ModuleType.EXPORT;
    }

    function localforageSetItems(items, keyFn, valueFn, callback) {
        var localforageInstance = this;
        var currentDriver = localforageInstance.driver();

        if (currentDriver === localforageInstance.INDEXEDDB) {
            return setItemsIndexedDB.call(localforageInstance, items, keyFn, valueFn, callback);
        } else if (currentDriver === localforageInstance.WEBSQL) {
            return setItemsWebsql.call(localforageInstance, items, keyFn, valueFn, callback);
        } else {
            return setItemsGeneric.call(localforageInstance, items, keyFn, valueFn, callback);
        }
    }

    function forEachItem(items, keyFn, valueFn, loopFn) {
        function ensurePropGetterMethod (propFn, defaultPropName) {
            var propName = propFn || defaultPropName;

            if ((!propFn || typeof propFn !== 'function') &&
                typeof propName === 'string') {
                propFn = function(item){ return item[propName]; };
            }
            return propFn;
        }

        var result = [];
        // http://stackoverflow.com/questions/4775722/check-if-object-is-array
        if (Object.prototype.toString.call(items) === '[object Array]') {
            keyFn = ensurePropGetterMethod(keyFn, 'key');
            valueFn = ensurePropGetterMethod(valueFn, 'value');

            for (var i = 0, len = items.length; i < len; i++) {
                var item = items[i];
                result.push(loopFn(keyFn(item), valueFn(item)));
            }
        } else {
            for (var prop in items) {
                if (items.hasOwnProperty(prop)) {
                    result.push(loopFn(prop, items[prop]));
                }
            }
        }
        return result;
    }

    function setItemsGeneric(items, keyFn, valueFn, callback) {
        var localforageInstance = this;

        var itemPromises = forEachItem(items, keyFn, valueFn, function(key, value) {
            return localforageInstance.setItem(key, value);
        });
        var promise = Promise.all(itemPromises);

        executeCallback(promise, callback);
        return promise;
    }

    function setItemsIndexedDB(items, keyFn, valueFn, callback) {
        var localforageInstance = this;

        var promise = new Promise(function(resolve, reject) {
            localforageInstance.ready().then(function() {
                // Inspired from @lu4 PR mozilla/localForage#318
                var dbInfo = localforageInstance._dbInfo;
                var transaction = dbInfo.db.transaction(dbInfo.storeName, 'readwrite');
                var store = transaction.objectStore(dbInfo.storeName);

                var itemPromises = forEachItem(items, keyFn, valueFn, function(key, value) {
                    // The reason we don't _save_ null is because IE 10 does
                    // not support saving the `null` type in IndexedDB. How
                    // ironic, given the bug below!
                    // See: https://github.com/mozilla/localForage/issues/161
                    if (value === null) {
                        value = undefined;
                    }
                    var request = store.put(value, key);

                    return new Promise(function(resolve, reject){
                        request.onsuccess = resolve;
                        request.onerror = function() {
                            reject(request.error);
                        };
                    });
                });

                Promise.all(itemPromises).then(function(){
                    transaction.oncomplete = function() {
                        resolve(items);
                    };
                })['catch'](reject);

                transaction.onabort = transaction.onerror = function(event) {
                    reject(event.target);
                };

            })['catch'](reject);
        });
        executeCallback(promise, callback);
        return promise;
    }

    function setItemsWebsql(items, keyFn, valueFn, callback) {
        var localforageInstance = this;
        var promise = new Promise(function(resolve, reject) {
            localforageInstance.ready().then(function() {
                return getSerializer(localforageInstance);
            }).then(function(serializer) {
                // Inspired from @lu4 PR mozilla/localForage#318
                var dbInfo = localforageInstance._dbInfo;
                dbInfo.db.transaction(function(t) {

                    var query = 'INSERT OR REPLACE INTO ' +
                         dbInfo.storeName +
                         ' (key, value) VALUES (?, ?)';

                    var itemPromises = forEachItem(items, keyFn, valueFn, function(key, value) {
                        return new Promise(function(resolve, reject){
                            serializer.serialize(value, function(value, error) {
                                if (error) {
                                    reject(error);
                                } else {
                                    t.executeSql(query,[key, value], function() {
                                        resolve();
                                    }, function(t, error) {
                                        reject(error);
                                    });
                                }
                            });
                        });
                    });

                    Promise.all(itemPromises).then(function(){
                        resolve(items);
                    }, reject);
                }, function(sqlError) {
                    reject(sqlError);
                }/*, function() {
                    if (resolving) {
                        resolve(items);
                    }
                }*/);
            })['catch'](reject);
        });
        executeCallback(promise, callback);
        return promise;
    }


    function getSerializer(localforageInstance) {
        if (serializer) {
            return Promise.resolve(serializer);
        }

        // add support for localforage v1.3.x
        if (localforageInstance &&
            typeof localforageInstance.getSerializer === 'function') {
            return localforageInstance.getSerializer();
        }

        var serializerPromise = new Promise(function(resolve/*, reject*/) {
            // We allow localForage to be declared as a module or as a
            // library available without AMD/require.js.
            if (moduleType === ModuleType.DEFINE) {
                require(['localforageSerializer'], resolve);
            } else if (moduleType === ModuleType.EXPORT) {
                // Making it browserify friendly
                resolve(require('./../utils/serializer'));
            } else {
                resolve(globalObject.localforageSerializer);
            }
        });

        return serializerPromise.then(function(lib) {
            serializer = lib;
            return Promise.resolve(serializer);
        });
    }

    function executeCallback(promise, callback) {
        if (callback) {
            promise.then(function(result) {
                callback(null, result);
            }, function(error) {
                callback(error);
            });
        }
    }

    function extendPrototype(localforage) {
        var localforagePrototype = Object.getPrototypeOf(localforage);
        if (localforagePrototype) {
            localforagePrototype.setItems = localforageSetItems;
            localforagePrototype.setItems.indexedDB = function(){
                return setItemsIndexedDB.apply(this, arguments);
            };
            localforagePrototype.setItems.websql = function(){
                return setItemsWebsql.apply(this, arguments);
            };
            localforagePrototype.setItems.generic = function(){
                return setItemsGeneric.apply(this, arguments);
            };
        }
    }

    if (moduleType === ModuleType.DEFINE) {
        define(['localforage'], function(localforage) {
            extendPrototype(localforage);
            return localforageSetItems;
        });
    } else if (moduleType === ModuleType.EXPORT) {
        extendPrototype(localforage);
        module.exports = localforageSetItems;
    } else {
        extendPrototype(localforage);
        this.localforageSetItems = localforageSetItems;
    }
}).call(window);
