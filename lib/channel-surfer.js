'use strict';

var EventEmitter = require('events').EventEmitter;
var util = require('./util');
var uuid = require('node-uuid').v4;
var Fixture = require('./fixture');

module.exports = ChannelSurfer;

/**
 * Root of our wrapper
 */
function ChannelSurfer(conn) {
  var self = this;
  this.emitErr = util.emitErr(this);
  this.conn = conn;
  this.channel = conn.channel;
  this.id = uuid();
  this.fixture = new Fixture(this.id);

  this.replayListener = function replayListener() {
    return self.replay();
  };

  this.setup();

  EventEmitter.call(this);


}

ChannelSurfer.prototype = Object.create(EventEmitter.prototype);

/**
 * Wraps the channel logic in something we can use for queues, exchanges
 * @param  {String}   method
 * @param  {Array}   args
 * @param  {Boolean}   fixture
 * @param  {Function} cb
 * @return {this}
 */
ChannelSurfer.prototype.call = function(method, args, fixture, cb) {
  var self = this;
  cb = 'function' === typeof cb ? cb : this.emitErr;

  this.channel.call(method, args)
    .then(addFixture)
    .then(util.curry(cb, null), util.invokeErr(cb))
    .otherwise(this.emitErr);

  return this;

  function addFixture(res) {
    if (fixture) {
      self.fixture.add('call', 'ch', [method, args]);
    }

    return res;
  }
};

/**
 * Cleans up listeners, etc.
 * @return {this}
 */
ChannelSurfer.prototype.clean = function() {
  this.channel.removeListener('channel error', this.replayListener);
  this.channel.removeListener('reconnected', this.replayListener);
  this.fixture.clean();
  return this;
};

/**
 * Initial set up before methods are called
 * @return {this}
 */
ChannelSurfer.prototype.setup = function() {
  this.fixture.dep('ch', this.channel);
  this.channel.on('channel error', this.replayListener);
  this.channel.on('reconnected', this.replayListener);
  return this;
};

/**
 * Replays stuff on this surfer
 * @return {Fixture}
 */
ChannelSurfer.prototype.replay = function() {
  return this.fixture.run();
};

/**
 * Shorthand for `Fixture.prototype.remove`
 * @param  {Function} fn
 * @param  {Function} filter
 * @return {this}
 */
ChannelSurfer.prototype.forget = function(fn, filter) {
  this.fixture.remove('call', 'ch', argFilter);

  return this;

  function argFilter(args) {
    var fnMatches = args[0] === fn;

    filter = 'function' === typeof filter ? filter : gimmeTrue;

    return fnMatches && filter(args[1]);
  }
};

function gimmeTrue() {
  return true;
}

function nop() {}