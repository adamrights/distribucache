var proxyquire = require('proxyquire').noCallThru(),
  stub = require('sinon').stub,
  joi = require('joi');

describe('decorators/PopulateDecorator', function () {
  var PopulateDecorator, unit, cache,
    noop, store, lease, populate;

  beforeEach(function () {
    var modulePath;

    function noop() {}
    cache = stub({
      on: noop,
      emit: noop,
      _getStore: noop,
      get: noop,
      del: noop,
      set: noop
    });

    store = stub({
      createLease: noop
    });
    lease = stub();
    store.createLease.returns(lease);
    cache._getStore.returns(store);

    populate = stub();

    modulePath = '../../lib/decorators/PopulateDecorator';
    PopulateDecorator = proxyquire(modulePath, {
    });

    unit = new PopulateDecorator(cache, {
      populate: populate
    });
  });

  it('should call leasedPopulate on stale event', function (done) {
     var onStaleEvent = cache.on.lastCall.args[1];
     unit.leasedPopulate = function (k, cb) {
       k.should.equal('a');
       cb.should.be.type('function');
       done();
     };
     onStaleEvent('a');
  });

  describe('get', function () {
    it('should return a cached value if in cache', function (done) {
      cache.get.yields(null, 'v');
      unit.get('k', function (err, val) {
        val.should.equal('v');
        done();
      });
    });

    it('should proxy through populate if not in cache', function (done) {
      cache.get.yields(null, null);
      populate.yields(null);
      cache.set.yields(null, 'pv');
      unit.get('k', function (err, val) {
        if (err) return done(err);
        val.should.equal('pv');
        done();
      });
    });
  });

  describe('populate', function () {
    it('should return an error', function (done) {
      unit = new PopulateDecorator(cache, {
        populate: function () {
          throw new Error('bad');
        }
      });
      unit.populate('k', function (err) {
        err.message.should.match(/populate threw/);
        done();
      });
    });
  });

  describe('leasedPopulate', function () {
    beforeEach(function () {
      unit.populate = stub();
    });

    it('should acquire lock lease, populate, and unlock', function (done) {
      var unlock = stub();
      function check(err, val) {
        if (err) return done(err);
        val.should.equal('v');
        unlock.calledOnce.should.be.ok;
        done();
      }
      lease.yields(null, unlock);
      unit.populate.yields(null, 'v');
      unit.leasedPopulate('k', check);
    });

    it('should not return an error or populate if locked', function (done) {
      var err = new Error();
      err.name = 'AlreadyLeasedError';
      lease.yields(err);
      unit.leasedPopulate('k', done);
    });

    it('should return an error if lock returned one', function (done) {
      function check(err) {
        err.message.should.match(/good/);
        done();
      }
      lease.yields(new Error('good'));
      unit.leasedPopulate('k', check);
    });

    it('should proxy populate error', function (done) {
      var unlock = stub();
      function check(err, val) {
        err.name.should.equal('PopulateError');
        err.message.should.match(/failed to populate/);
        done();
      }
      lease.yields(null, unlock);
      unit.populate.yields(new Error('bad'));
      unit.leasedPopulate('k', check);
    });
  });
});
