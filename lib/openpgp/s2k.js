// Generated by IcedCoffeeScript 1.7.1-b
(function() {
  var C, S2K, SHA256, SecretKeyMaterial, alloc, triplesec, _ref;

  triplesec = require('triplesec');

  C = require('../const').openpgp;

  _ref = require('../hash'), alloc = _ref.alloc, SHA256 = _ref.SHA256;

  S2K = (function() {
    S2K.prototype._count = function(c, bias) {
      return (16 + (c & 15)) << ((c >> 4) + bias);
    };

    function S2K() {
      this.hash = SHA256;
    }

    S2K.prototype.set_hash_algorithm = function(which) {
      if ((this.hash = alloc(which)) == null) {
        console.warn("No such hash: " + which + "; defaulting to SHA-256");
        return this.hash = SHA256;
      }
    };

    S2K.prototype.read = function(slice) {
      var c;
      this.type = slice.read_uint8();
      switch (this.type) {
        case C.s2k.plain:
          this.set_hash_algorithm(slice.read_uint8());
          break;
        case C.s2k.salt:
          this.set_hash_algorithm(slice.read_uint8());
          this.salt = slice.read_buffer(8);
          break;
        case C.s2k.salt_iter:
          this.set_hash_algorithm(slice.read_uint8());
          this.salt = slice.read_buffer(8);
          this.EXPBIAS = 6;
          c = slice.read_uint8();
          this.count = this._count(c, this.EXPBIAS);
          break;
        case C.s2k.gnu:
          this.read_gnu_extensions(slice);
          break;
        default:
          throw new Error("unknown s2k type! " + this.type);
      }
      return this;
    };

    S2K.prototype.read_gnu_extensions = function(slice) {
      var buf, gnu_ext_type, id, version;
      version = slice.read_uint8();
      if ((id = (buf = slice.read_buffer(3)).toString('utf8')) === "GNU") {
        gnu_ext_type = slice.read_uint8() + 1000;
        switch (gnu_ext_type) {
          case 1001:
            return this.type = C.s2k.gnu_dummy;
          default:
            throw new ("unknown s2k gnu protection mode: " + gnu_ext_type);
        }
      } else {
        throw new Error("Malformed GNU-extension: " + ext);
      }
    };

    S2K.prototype.write = function(passphrase, salt, c, keysize) {
      var type;
      this.type = type = 3;
      this.salt = salt;
      this.count = this._count(c, 6);
      this.s2kLength = 10;
      return this.produce_key(passphrase, keysize);
    };

    S2K.prototype.is_dummy = function() {
      return this.type === C.s2k.gnu_dummy;
    };

    S2K.prototype.produce_key = function(passphrase, numBytes) {
      var i, isp, key, n, ret, seed;
      if (numBytes == null) {
        numBytes = 16;
      }
      ret = (function() {
        switch (this.type) {
          case C.s2k.plain:
            return this.hash(passphrase);
          case C.s2k.salt:
            return this.hash(Buffer.concat([this.salt, passphrase]));
          case C.s2k.salt_iter:
            seed = Buffer.concat([this.salt, passphrase]);
            n = Math.ceil(this.count / seed.length);
            isp = Buffer.concat((function() {
              var _i, _results;
              _results = [];
              for (i = _i = 0; 0 <= n ? _i < n : _i > n; i = 0 <= n ? ++_i : --_i) {
                _results.push(seed);
              }
              return _results;
            })()).slice(0, this.count);
            if ((numBytes != null) && (numBytes === 24 || numBytes === 32)) {
              key = this.hash(isp);
              return Buffer.concat([key, this.hash(Buffer.concat([new Buffer([0]), isp]))]);
            } else {
              return this.hash(isp);
            }
            break;
          default:
            return null;
        }
      }).call(this);
      return ret.slice(0, numBytes);
    };

    return S2K;

  })();

  SecretKeyMaterial = (function() {
    function SecretKeyMaterial() {
      this.s2k_convention = null;
      this.s2k = null;
      this.iv = null;
      this.cipher = null;
      this.payload = null;
    }

    SecretKeyMaterial.prototype.is_dummy = function() {
      return (this.s2k != null) && this.s2k.is_dummy();
    };

    SecretKeyMaterial.prototype.has_private = function() {
      return !this.is_dummy();
    };

    SecretKeyMaterial.prototype.is_locked = function() {
      return (this.s2k_convention !== C.s2k_convention.none) && !(this.is_dummy());
    };

    return SecretKeyMaterial;

  })();

  exports.S2K = S2K;

  exports.SecretKeyMaterial = SecretKeyMaterial;

}).call(this);
