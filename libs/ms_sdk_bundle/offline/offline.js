/**
 * Created by Maxim Balyaba on 2/1/2016.
 */
(function (root, factory) {
    "use strict";

    if (typeof define === 'function' && define.amd) {
        define([], function () {
            return factory();
        });
    } else {
        root.Offline = factory();
    }

}(this, function () {
    "use strict";

    var Offline, checkXHR, defaultOptions, handlers;

    Offline = {};

    Offline.lastEvent = undefined;

    Offline.state = 'up';

    Offline._isListening = false;

    handlers = {};

    Offline.options = Offline.options || {};

    Offline.checks = {};

    defaultOptions = {
        checks: {
            xhr: {
                url: function() {
                    return "/favicon.ico?_=" + (Math.floor(Math.random() * 1000000000));
                },
                timeout: 5000,
                type: 'HEAD'
            },
            image: {
                url: function() {
                    return "/favicon.ico?_=" + (Math.floor(Math.random() * 1000000000));
                }
            },
            active: 'xhr'
        }
    };

    Offline.grab = function(obj, key) {
        var cur, i, part, parts, _i, _len;
        cur = obj;
        parts = key.split('.');
        for (i = _i = 0, _len = parts.length; _i < _len; i = ++_i) {
            part = parts[i];
            cur = cur[part];
            if (typeof cur !== 'object') {
                break;
            }
        }
        if (i === parts.length - 1) {
            return cur;
        } else {
            return void 0;
        }
    };

    Offline.getOption = function(key) {
        var val, _ref;
        val = (_ref = Offline.grab(Offline.options, key)) != null ? _ref : Offline.grab(defaultOptions, key);
        if (typeof val === 'function') {
            return val();
        } else {
            return val;
        }
    };

    Offline.onlineEventHandler = function(){
        if(Offline.lastEvent !== 'online'){
            Offline.lastEvent = 'online';
            return setTimeout(Offline.confirmUp, 100);
        }
    }

    Offline.offlineEventHandler = function(){
        if(Offline.lastEvent !== 'offline'){
            Offline.lastEvent = 'offline';
            return Offline.confirmDown();
        }
    }

    Offline.markUp = function() {
        Offline.lastEvent = 'online';
        Offline.trigger('confirmed-up');
        if (Offline.state === 'up') {
            return;
        }
        Offline.state = 'up';
        return Offline.trigger('up');
    };

    Offline.markDown = function() {
        Offline.lastEvent = 'offline';
        Offline.trigger('confirmed-down');
        if (Offline.state === 'down') {
            return;
        }
        Offline.state = 'down';
        return Offline.trigger('down');
    };

    Offline.on = function(event, handler, ctx) {
        var e, events, _i, _len, _results;
        events = event.split(' ');
        if (events.length > 1) {
            _results = [];
            for (_i = 0, _len = events.length; _i < _len; _i++) {
                e = events[_i];
                _results.push(Offline.on(e, handler, ctx));
            }
            return _results;
        } else {
            if (handlers[event] == null) {
                handlers[event] = [];
            }
            return handlers[event].push([ctx, handler]);
        }
    };

    Offline.off = function(event, handler) {
        var ctx, i, _handler, _ref, _results;
        if (handlers[event] == null) {
            return;
        }
        if (!handler) {
            return handlers[event] = [];
        } else {
            i = 0;
            _results = [];
            while (i < handlers[event].length) {
                _ref = handlers[event][i], ctx = _ref[0], _handler = _ref[1];
                if (_handler === handler) {
                    _results.push(handlers[event].splice(i, 1));
                } else {
                    _results.push(i++);
                }
            }
            return _results;
        }
    };

    Offline.trigger = function(event) {
        var ctx, handler, _i, _len, _ref, _ref1, _results;
        if (handlers[event] != null) {
            _ref = handlers[event];
            _results = [];
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
                _ref1 = _ref[_i], ctx = _ref1[0], handler = _ref1[1];
                _results.push(handler.call(ctx));
            }
            return _results;
        }
    };

    checkXHR = function(xhr, onUp, onDown) {
        var checkStatus, _onerror, _onload, _onreadystatechange, _ontimeout;
        checkStatus = function() {
            if (xhr.status && xhr.status < 12000) {
                return onUp();
            } else {
                return onDown();
            }
        };
        if (xhr.onprogress === null) {
            _onerror = xhr.onerror;
            xhr.onerror = function() {
                onDown();
                return typeof _onerror === "function" ? _onerror.apply(null, arguments) : void 0;
            };
            _ontimeout = xhr.ontimeout;
            xhr.ontimeout = function() {
                onDown();
                return typeof _ontimeout === "function" ? _ontimeout.apply(null, arguments) : void 0;
            };
            _onload = xhr.onload;
            return xhr.onload = function() {
                checkStatus();
                return typeof _onload === "function" ? _onload.apply(null, arguments) : void 0;
            };
        } else {
            _onreadystatechange = xhr.onreadystatechange;
            return xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                    checkStatus();
                } else if (xhr.readyState === 0) {
                    onDown();
                }
                return typeof _onreadystatechange === "function" ? _onreadystatechange.apply(null, arguments) : void 0;
            };
        }
    };

    Offline.checks.xhr = function() {
        var e, xhr;
        xhr = new XMLHttpRequest;
        xhr.offline = false;
        xhr.open(Offline.getOption('checks.xhr.type'), Offline.getOption('checks.xhr.url'), true);
        if (xhr.timeout != null) {
            xhr.timeout = Offline.getOption('checks.xhr.timeout');
        }
        checkXHR(xhr, Offline.markUp, Offline.markDown);
        try {
            xhr.send();
        } catch (_error) {
            e = _error;
            Offline.markDown();
        }
        return xhr;
    };

    Offline.checks.down = Offline.markDown;

    Offline.checks.up = Offline.markUp;

    Offline.check = function() {
        Offline.trigger('checking');
        return Offline.checks.xhr();
    };

    Offline.confirmUp = Offline.confirmDown = Offline.check;

    Offline.isListeningForNetworkChange = function(){
        return Offline._isListening || false;
    }

    Offline.listen = function(){
        Offline._isListening = true;
        if (window.addEventListener) {
            window.addEventListener("online", Offline.onlineEventHandler, true);
            window.addEventListener("offline", Offline.offlineEventHandler, true);
        } else {
            document.body.ononline = Offline.onlineEventHandler;
            document.body.onoffline = Offline.offlineEventHandler;
        }
    }

    return Offline;
}));