;(function(global) {

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

  var UNLIMITED = -1;
  var START_OFFSET = 0;

  function addFind(localforage) {
    var localforagePrototype = Object.getPrototypeOf(localforage);
    if (localforagePrototype) {
      localforagePrototype.find = function find(criteria, options) {
        var limit;
        var offset;
        options = options || {};
        limit = options.limit || UNLIMITED;
        offset = options.offset || START_OFFSET;
        // limit was specified
        if (typeof limit != 'number') {
          limit = UNLIMITED;
        }
        if (typeof offset != 'number') {
          offset = START_OFFSET;
        }

        var lf = this;
        var promise = lf.length().then(function (storeLength) {
          // no data stored
          if (!storeLength) return [];
          // asked for no results
          if (!limit) return [];
          //invalid offset
          if (offset > storeLength){
            return [];
          }

          var results = [],
              pairsSeen = offset,
              pairsExpected = storeLength;

          var iterator = function (value, key) {
            if (criteria(key, value)) {
              results.push(value);
            }

            pairsSeen += 1;

            // Stop iterating and return results if we...

            // have checked every key/value pair
            if (pairsSeen == pairsExpected){
              return results;
            }
            // or have found enough results
            if (limit != UNLIMITED && results.length == limit){
              return results;
            }
          };

          iterator.cursorOptions = {
            cursorOffset: offset
          }

          return lf.iterate(iterator);
        });

        return promise;
      };
    }
  }

  if (typeof define === 'function' && define.amd) {
    define(['localforage'], function(localforage) {
      addFind(localforage);
    });
  }

  if (moduleType === ModuleType.DEFINE) {
    define(['localforage'], function(localforage) {
      addFind(localforage);
    });
  } else if (moduleType === ModuleType.EXPORT) {
    module.exports = addFind;
  } else {
    addFind(localforage);
  }

})(this);