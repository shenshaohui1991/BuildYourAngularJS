/**
 * Created by Tea on 2017/3/22.
 */
'use strict';

var spy = require('mochaccino').spy;
var jExpect = require('mochaccino').expect;
var expect = require('chai').expect;
var Scope = require('../src/scope.js');
var _ = require('lodash');

describe('Scope', function () {
    it('can be constructed and used as an object', function () {
        var scope = new Scope();
        scope.aProp = 1;

        expect(scope.aProp).to.be.equal(1);
    });

    describe('digest', function () {
        var scope;

        beforeEach(function () {
            scope = new Scope();
        });

        it('call the listener function of a watch on first $digest', function () {
            var watchFn = function () {
                return 'watch';
            };
            var listenFn = spy();

            scope.$watch(watchFn, listenFn);
            scope.$digest();

            jExpect(listenFn).toHaveBeenCalled();
        });

        it('calls the watch function with the scope as the argument', function () {
            var watchFn = spy();
            var listenFn = function () {
            };

            scope.$watch(watchFn, listenFn);
            scope.$digest();

            jExpect(watchFn).toHaveBeenCalledWith(scope);
        });

        it('calls the listener function when the watched value changes', function () {
            scope.someValue = 'a';
            scope.counter = 0;

            scope.$watch(function (scope) {
                return scope.someValue;
            }, function (newValue, oldValue, scope) {
                scope.counter++;
            });

            expect(scope.counter).to.be.equal(0);

            scope.$digest();
            expect(scope.counter).to.be.equal(1);

            scope.$digest();
            expect(scope.counter).to.be.equal(1);

            scope.someValue = 'b';
            expect(scope.counter).to.be.equal(1);

            scope.$digest();
            expect(scope.counter).to.be.equal(2);

            scope.$digest();
            expect(scope.counter).to.be.equal(2);
        });

        it('calls listener when watch value is first undefined', function () {
            scope.counter = 0;
            scope.$watch(function (scope) {
                return scope.someValue;
            }, function (newValue, oldValue, scope) {
                scope.counter++;
            });

            scope.$digest();
            expect(scope.counter).to.be.equal(1);
        });

        it('calls listener with new value as old value the first time', function () {
            scope.someValue = 123;
            var oldValueGiven;

            scope.$watch(function (scope) {
                return scope.someValue;
            }, function (newValue, oldValue, scope) {
                oldValueGiven = oldValue;
            });
            scope.$digest();

            expect(oldValueGiven).to.be.equal(123);
        });

        it('may have watchers that omit the listener function', function () {
            var watchFn = spy();
            scope.$watch(watchFn);
            scope.$digest();

            jExpect(watchFn).toHaveBeenCalled();
        });

        it('triggers chained watchers in the same digest', function () {
            scope.$watch(function (scope) {
                return scope.nameUpper;
            }, function (newValue, oldValue, scope) {
                if (newValue) {
                    scope.initial = newValue.substring(0, 1) + '.';
                }
            });
            scope.$watch(function (scope) {
                return scope.name;
            }, function (newValue, oldValue, scope) {
                if (newValue) {
                    scope.nameUpper = newValue.toUpperCase();
                }
            });

            scope.name = 'Jane';
            scope.$digest();
            expect(scope.initial).to.be.equal('J.');

            scope.name = 'Bob';
            scope.$digest();
            expect(scope.initial).to.be.equal('B.');
        });

        it('gives up on the watches after 10 iterations', function() {
            scope.counterA = 0;
            scope.counterB = 0;

            scope.$watch(function (scope) {
                return scope.counterA;
            }, function (newValue, oldValue, scope) {
                scope.counterB++;
            });

            scope.$watch(function (scope) {
                return scope.counterB;
            }, function (newValue, oldValue, scope) {
                scope.counterA++;
            });

            jExpect(function () {
                scope.$digest()
            }).toThrow();
        });

        it('ends the digest when the last watch is clean', function () {
            scope.array = _.range(100);
            var watchExecutions = 0;

            _.times(100, function (i) {
                scope.$watch(function (scope) {
                    watchExecutions++;
                    return scope.array[i];
                }, function (newValue, oldValue, scope) {

                });
            });

            scope.$digest();
            // 设定值 和 init值比较(100次)，$$lastDirtyWatch为scope.array[99]对应的watch，他需要检查到$$lastDirtyWatch没有变化才能停止
            expect(watchExecutions).to.be.equal(200);

            scope.array[0] = 420;
            scope.$digest();
            // 同上$$lastDirtyWatch为scope.array[0]所对应的watch，所以需要循环100 + 1
            expect(watchExecutions).to.be.equal(301);
        });

        it('does not end digest so that new watches are not run', function () {
            scope.aValue = 'abc';
            scope.counter = 0;

            scope.$watch(function (scope) {
                return scope.aValue;
            }, function (newValue, oldValue, scope) {
                scope.$watch(function (scope) {
                    return scope.aValue;
                }, function (newValue, oldValue, scope) {
                    scope.counter++;
                });
            });

            scope.$digest();
            expect(scope.counter).to.be.equal(1);
        });

        it('compares based on value if enabled', function () {
            scope.aValue = [1, 2, 3];
            scope.counter = 0;

            scope.$watch(function (scope) {
                return scope.aValue;
            }, function (newValue, oldValue, scope) {
                scope.counter++;
            }, true);

            scope.$digest();
            expect(scope.counter).to.be.equal(1);

            scope.aValue.push(4);
            scope.$digest();
            expect(scope.counter).to.be.equal(2);
        });

        it('correctly handles NaNs', function () {
            scope.number = 0 / 0;
            scope.counter = 0;

            scope.$watch(function (scope) {
                return scope.number;
            }, function (newValue, oldValue, scope) {
                scope.counter++;
            });

            scope.$digest();
            expect(scope.counter).to.be.equal(1);

            scope.$digest();
            expect(scope.counter).to.be.equal(1);
        });

        it('exexecutes $eval\'ed function and returns result', function () {
            scope.aValue = 42;

            var result = scope.$eval(function (scope) {
                return scope.aValue;
            });

            expect(result).to.be.equal(42);
        });

        it('passes the second $eval argument straight through',  function () {
            scope.aValue = 42;

            var result = scope.$eval(function (scope, arg) {
               return scope.aValue + arg;
            }, 2);

            expect(result).to.be.equal(44);
        });

        it('executes $apply\'ed function and starts the digest', function () {
            scope.aValue = 'someValue';
            scope.counter = 0;

            scope.$watch(function (scope) {
                return scope.aValue;
            }, function (newValue, oldValue, scope) {
                scope.counter++;
            });

            scope.$digest();
            expect(scope.counter).to.be.equal(1);

            scope.$apply(function (scope) {
                scope.aValue = 'someOtherValue';
            });
            expect(scope.counter).to.be.equal(2);
        });

        it('executes $evalAsync\'ed function later in the same cycle', function () {
            scope.aValue = [1, 2, 3];
            scope.asyncEvaluated = false;
            scope.asyncEvaluatedImmediately = false;

            scope.$watch(function (scope) {
                return scope.aValue;
            }, function (newValue, oldValue, scope) {
                scope.$evalAsync(function (scope) {
                    scope.asyncEvaluated = true;
                });
                scope.asyncEvaluatedImmediately = scope.asyncEvaluated;
            });

            scope.$digest();
            expect(scope.asyncEvaluated).to.be.true;
            expect(scope.asyncEvaluatedImmediately).to.be.false;
        });

        it("executes $evalAsync'ed functions added by watch functions", function () {
            scope.aValue = [1, 2, 3];
            scope.asyncEvaluated = false;

            scope.$watch(function (scope) {
                if (!scope.asyncEvaluated) {
                    scope.asyncEvaluated = true;
                }
                return scope.aValue;
            }, function () {

            });

            scope.$digest();
            expect(scope.asyncEvaluated).to.be.true;
        });

        it("executes $evalAsync'ed functions even when not dirty", function () {
            scope.aValue = [1, 2, 3];
            scope.asyncEvaluatedTimes = 0;

            scope.$watch(function (scope) {
                if (scope.asyncEvaluatedTimes < 2) {
                    scope.$evalAsync(function (scope) {
                        scope.asyncEvaluatedTimes++;
                    });
                }
                return scope.aValue;
            }, function () {});

            scope.$digest();
            expect(scope.asyncEvaluatedTimes).to.be.equal(2);
        });

        it('eventually halts $evalAsyncs added by watches', function () {
            scope.aValue = [1, 2, 3];

            scope.$watch(function (scope) {
                scope.$evalAsync(function (scope) {});
                return scope.aValue;
            }, function () {});

            jExpect(function () {
                scope.$digest()
            }).toThrow();
        });

        it("has a $$phase field whose value is the current digest phase", function() {
            scope.aValue = [1, 2, 3];
            scope.phaseInWatchFunction = undefined;
            scope.phaseInListenerFunction = undefined;
            scope.phaseInApplyFunction = undefined;
            scope.$watch(
                function(scope) {
                    scope.phaseInWatchFunction = scope.$$phase;
                    return scope.aValue;
                },
                function(newValue, oldValue, scope) {
                    scope.phaseInListenerFunction = scope.$$phase;
                }
            );
            scope.$apply(function(scope) {
                scope.phaseInApplyFunction = scope.$$phase;
            });
            expect(scope.phaseInWatchFunction).to.be.equal('$digest');
            expect(scope.phaseInListenerFunction).to.be.equal('$digest');
            expect(scope.phaseInApplyFunction).to.be.equal('$apply');
        });

        it('schedules a digest in $evalAsync', function (done) {
            scope.aValue = 'abc';
            scope.counter = 0;

            scope.$watch(function (scope) {
                return scope.aValue;
            }, function (newValue, oldValue, scope) {
                scope.counter++;
            });

            scope.$evalAsync(function () {});

            expect(scope.counter).to.be.equal(0);
            setTimeout(function () {
                expect(scope.counter).to.be.equal(1);
                done();
            }, 50);
        });

        it('allows async $apply with $applyAsync', function(done) {
            scope.counter = 0;
            scope.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );

            scope.$digest();
            expect(scope.counter).to.be.equal(1);

            scope.$applyAsync(function(scope) {
                scope.aValue = 'abc';
            });
            expect(scope.counter).to.be.equal(1);

            setTimeout(function() {
                expect(scope.counter).to.be.equal(2);
                done();
            }, 50);
        });

        it("never executes $applyAsync'ed function in the same cycle", function(done) {
            scope.aValue = [1, 2, 3];
            scope.asyncApplied = false;
            scope.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    scope.$applyAsync(function(scope) {
                        scope.asyncApplied = true;
                    });
                }
            );
            scope.$digest();
            expect(scope.asyncApplied).to.be.false;
            setTimeout(function() {
                expect(scope.asyncApplied).to.be.true;
                done();
            }, 50);
        });

        it('coalesces many calls to $applyAsync', function(done) {
            scope.counter = 0;
            scope.$watch(
                function(scope) {
                    scope.counter++;
                    return scope.aValue;
                },
                function(newValue, oldValue, scope) { }
            );
            scope.$applyAsync(function(scope) {
                scope.aValue = 'abc';
            });
            scope.$applyAsync(function(scope) {
                scope.aValue = 'def';
            });
            setTimeout(function() {
                expect(scope.counter).to.be.equal(2);
                done();
            }, 50);
        });

        it('cancels and flushes $applyAsync if digested first', function(done) {
            scope.counter = 0;
            scope.$watch(
                function(scope) {
                    scope.counter++;
                    return scope.aValue;
                },
                function(newValue, oldValue, scope) { }
            );
            scope.$applyAsync(function(scope) {
                scope.aValue = 'abc';
            });
            scope.$applyAsync(function(scope) {
                scope.aValue = 'def';
            });
            scope.$digest();
            expect(scope.counter).to.be.equal(2);
            expect(scope.aValue).to.be.equal('def');
            setTimeout(function() {
                expect(scope.counter).to.be.equal(2);
                done();
            }, 50);
        });

        it("runs a $$postDigest function after each digest", function() {
            scope.counter = 0;
            scope.$$postDigest(function() {
                scope.counter++;
            });
            expect(scope.counter).to.be.equal(0);
            scope.$digest();
            expect(scope.counter).to.be.equal(1);
            scope.$digest();
            expect(scope.counter).to.be.equal(1);
        });

        it("does not include $$postDigest in the digest", function() {
            scope.aValue = 'original value';
            scope.$$postDigest(function() {
                scope.aValue = 'changed value';
            });
            scope.$watch(
                function(scope) {
                    return scope.aValue;
                },
                function(newValue, oldValue, scope) {
                    scope.watchedValue = newValue;
                }
            );
            scope.$digest();
            expect(scope.watchedValue).to.be.equal('original value');
            scope.$digest();
            expect(scope.watchedValue).to.be.equal('changed value');
        });

        it("catches exceptions in watch functions and continues", function() {
            scope.aValue = 'abc';
            scope.counter = 0;
            scope.$watch(
                function(scope) { throw "error"; },
                function(newValue, oldValue, scope) { }
            );
            scope.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );
            scope.$digest();
            expect(scope.counter).to.be.equal(1);
        });

        it("catches exceptions in listener functions and continues", function() {
            scope.aValue = 'abc';
            scope.counter = 0;
            scope.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    throw "Error";
                }
            );
            scope.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );
            scope.$digest();
            expect(scope.counter).to.be.equal(1);
        });

        it("catches exceptions in $evalAsync", function(done) {
            scope.aValue = 'abc';
            scope.counter = 0;
            scope.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );

            scope.$evalAsync(function(scope) {
                throw "Error";
            });

            setTimeout(function() {
                expect(scope.counter).to.be.equal(1);
                done();
            }, 50);
        });

        it("catches exceptions in $applyAsync", function(done) {
            scope.$applyAsync(function(scope) {
                throw "Error";
            });
            scope.$applyAsync(function(scope) {
                throw "Error";
            });
            scope.$applyAsync(function(scope) {
                scope.applied = true;
            });
            setTimeout(function() {
                expect(scope.applied).to.be.true;
                done();
            }, 50);
        });

        it("catches exceptions in $$postDigest", function() {
            var didRun = false;
            scope.$$postDigest(function() {
                throw "Error";
            });
            scope.$$postDigest(function() {
                didRun = true;
            });
            scope.$digest();
            expect(didRun).to.be.true;
        });

        it("allows destroying a $watch with a removal function", function() {
            scope.aValue = 'abc';
            scope.counter = 0;
            var destroyWatch = scope.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );
            scope.$digest();
            expect(scope.counter).to.be.equal(1);
            scope.aValue = 'def';
            scope.$digest();
            expect(scope.counter).to.be.equal(2);
            scope.aValue = 'ghi';
            destroyWatch();
            scope.$digest();
            expect(scope.counter).to.be.equal(2);
        });

        it("allows destroying a $watch during digest", function() {
            scope.aValue = 'abc';
            var watchCalls = [];
            scope.$watch(
                function(scope) {
                    watchCalls.push('first');
                    return scope.aValue;
                }
            );

            var destroyWatch = scope.$watch(
                function(scope) {
                    watchCalls.push('second');
                    destroyWatch();
                }
            );
            scope.$watch(
                function(scope) {
                    watchCalls.push('third');
                    return scope.aValue;
                }
            );
            scope.$digest();
            expect(watchCalls).to.deep.equal(['first', 'second', 'third', 'first', 'third']);
        });

        it("allows a $watch to destroy another during digest", function() {
            scope.aValue = 'abc';
            scope.counter = 0;
            scope.$watch(
                function(scope) {
                    return scope.aValue;
                },
                function(newValue, oldValue, scope) {
                    destroyWatch();
                }
            );
            var destroyWatch = scope.$watch(
                function(scope) { },
                function(newValue, oldValue, scope) { }
            );
            scope.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );
            scope.$digest();
            expect(scope.counter).to.be.equal(1);
        });

        it("allows destroying several $watches during digest", function() {
            scope.aValue = 'abc';
            scope.counter = 0;
            var destroyWatch1 = scope.$watch(
                function(scope) {
                    destroyWatch1();
                    destroyWatch2();
                }
            );
            var destroyWatch2 = scope.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );
            scope.$digest();
            expect(scope.counter).to.be.equal(0);
        });
        /////////////////////////
    });
});