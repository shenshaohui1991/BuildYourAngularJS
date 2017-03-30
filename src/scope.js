/**
 * Created by Tea on 2017/3/22.
 */
'use strict';

var _ = require('lodash');

function Scope() {
    // 存储watcher
    this.$$watchers = [];
    this.$$lastDirtyWatch = null;
    // 异步执行的任务队列
    this.$$asyncQueue = [];
    // 定时器ID
    this.$$applyAsyncId = null;
    // applyAsync任务队列
    this.$$applyAsyncQueue = [];
    // postDigest任务队列
    this.$$postDigestQueue = [];
    // 阶段
    this.$$phase = null;

}

/*
* watchFn: 监听的值
* listenerFn: 监听到改变之后执行的函数
* valueEq: 是否进行值比较
* */
Scope.prototype.$watch = function (watchFn, listenerFn, valueEq) {
    var self = this,
        watcher = {
            watchFn: watchFn,
            listenerFn: listenerFn || function () {},
            valueEq: !!valueEq,
            last: initWatchVal
        };


    self.$$watchers.unshift(watcher);
    self.$$lastDirtyWatch = null;

    // 删除watch
    return function () {
        var index = self.$$watchers.indexOf(watcher);
        if (index >= 0) {
            self.$$watchers.splice(index, 1);
            self.$$lastDirtyWatch = null;
        }
    };
};

Scope.prototype.$apply = function (expr) {
    try {
        this.$beginPhase('$apply');
        return this.$eval(expr);
    } finally {
        this.$clearPhase();
        this.$digest();
    }
};

Scope.prototype.$applyAsync = function (expr) {
    var self = this;
    self.$$applyAsyncQueue.push(function () {
        self.$eval(expr);
    });

    if (!self.$$applyAsyncId) {
        self.$$applyAsyncId = setTimeout(function () {
            // `_.bind` 等于 `Function.prototype.bind`，避免兼容性问题
            self.$apply(_.bind(self.$$flushApplyAsync, self));
        }, 0);
    }
};

Scope.prototype.$$postDigest = function (fn) {
    this.$$postDigestQueue.push(fn);
};

// 完成所有`applyAsync`任务
Scope.prototype.$$flushApplyAsync = function () {
    while (this.$$applyAsyncQueue.length) {
        try {
            this.$$applyAsyncQueue.shift()();
        } catch (e) {
            console.error(e);
        }
    }
    this.$$applyAsyncId = null
};

Scope.prototype.$eval = function (expr, locals) {
    return expr(this, locals);
};

Scope.prototype.$evalAsync = function (expr) {
    var self = this;

    // 不处于任何阶段 且 当前异步任务队列不存在任何任务，则在浏览器有空闲之后立即执行`$digest`
    if (!self.$$phase && !self.$$asyncQueue.length) {
        setTimeout(function () {
            if (self.$$asyncQueue.length) {
                self.$digest();
            }
        }, 0);
    }

    self.$$asyncQueue.push({
        scope: self, // 涉及到scope的继承，我们直接存储当前`scope`
        expression: expr
    });
};

Scope.prototype.$digest = function () {
    var dirty, ttl = 10;
    this.$$lastDirtyWatch = null;

    this.$beginPhase('$digest');

    if (this.$$applyAsyncId) {
        clearTimeout(this.$$applyAsyncId);
        this.$$flushApplyAsync();
    }

    do {
        // 清空异步队列
        while(this.$$asyncQueue.length) {
            try {
                var asyncTask = this.$$asyncQueue.shift();
                asyncTask.scope.$eval(asyncTask.expression);
            } catch(e) {
                console.error(e);
            }
        }

        // 脏检查
        dirty = this.$$digestOnce();
        if ((dirty || this.$$asyncQueue.length) && ttl-- <= 0) {
            this.$clearPhase();
            throw '10 digest iterations reached';
        }
    } while (dirty || this.$$asyncQueue.length);
    this.$clearPhase();

    while (this.$$postDigestQueue.length) {
        try {
            this.$$postDigestQueue.shift()();
        } catch (e) {
            console.error(e);
        }
    }
};

Scope.prototype.$$digestOnce = function () {
    var self = this,
        newValue, oldValue, dirty;

    _.forEachRight(this.$$watchers, function (watcher) {
        try {
            if (watcher) {
                newValue = watcher.watchFn(self);
                oldValue = watcher.last;

                if (!self.$$areEqual(newValue, oldValue, watcher.valueEq)) {
                    self.$$lastDirtyWatch = watcher;
                    watcher.last = watcher.valueEq ? _.cloneDeep(newValue) : newValue;
                    // 初始状态时，将newValue当成oldValue返回
                    watcher.listenerFn(newValue, (oldValue === initWatchVal ? newValue : oldValue), self);
                    dirty = true;
                } else if (self.$$lastDirtyWatch === watcher) {
                    return false;
                }
            }
        } catch (e) {
            console.error(e);
        }
    });

    return dirty;
};

Scope.prototype.$watchGroup = function(watchFns, listenerFn) {
    var self = this,
        newValues = new Array(watchFns.length),
        oldValues = new Array(watchFns.length),
        changeReactionScheduled = false,
        firstRun = true,
        shouldCall = true;

    if (watchFns.length === 0) {
        self.$evalAsync(function () {
            if (shouldCall) {
                listenerFn(newValues, newValues, self);
            }
        });

        return function () {
            shouldCall = false;
        };
    }

    function watchGroupListener() {
        if (firstRun) {
            firstRun = false;
            listenerFn(newValues, newValues, self);
        } else {
            listenerFn(newValues, oldValues, self);
        }

        changeReactionScheduled = false;
    }

    var destoryFns = _.map(watchFns, function (watchFn, i) {
        return self.$watch(watchFn, function (newValue, oldValue) {
            newValues[i] = newValue;
            oldValues[i] = oldValue;

            if (!changeReactionScheduled) {
                changeReactionScheduled = true;
                self.$evalAsync(watchGroupListener);
            }
        });
    });

    return function() {
        _.forEach(destoryFns, function (destoryFn) {
            destoryFn();
        });
    };
};

Scope.prototype.$beginPhase = function (phase) {
    if (this.$$phase) {
        throw this.$$phase + 'already in progress';
    }
    this.$$phase = phase;
};

Scope.prototype.$clearPhase = function () {
    this.$$phase = null;
};

/*
* 是否相等
* */
Scope.prototype.$$areEqual = function (newValue, oldValue, valueEq) {
    if (valueEq) {
        return _.isEqual(newValue, oldValue);
    } else {
        return newValue === oldValue ||
            (typeof newValue === 'number' && typeof oldValue === 'number' &&
            isNaN(newValue) && isNaN(oldValue))
    }
};

function initWatchVal() {}

module.exports = Scope;