// Generated by IcedCoffeeScript 1.7.1-b
(function() {
  var Burner, C, Compressed, CreationTime, Issuer, Literal, OnePassSignature, PKESK, SEIPD, SHA512, SRF, Signature, WordArray, clearsign, encode, export_key_pgp, get_cipher, iced, make_esc, make_simple_literals, scrub_buffer, triplesec, unix_time, __iced_k, __iced_k_noop, _ref, _ref1, _ref2;

  iced = require('iced-coffee-script/lib/coffee-script/iced').runtime;
  __iced_k = __iced_k_noop = function() {};

  make_esc = require('iced-error').make_esc;

  OnePassSignature = require('./packet/one_pass_sig').OnePassSignature;

  _ref = require('./packet/signature'), Signature = _ref.Signature, CreationTime = _ref.CreationTime, Issuer = _ref.Issuer;

  Compressed = require('./packet/compressed').Compressed;

  Literal = require('./packet/literal').Literal;

  unix_time = require('../util').unix_time;

  SRF = require('../rand').SRF;

  triplesec = require('triplesec');

  _ref1 = require('../symmetric'), export_key_pgp = _ref1.export_key_pgp, get_cipher = _ref1.get_cipher;

  scrub_buffer = triplesec.util.scrub_buffer;

  WordArray = triplesec.WordArray;

  _ref2 = require('./packet/sess'), SEIPD = _ref2.SEIPD, PKESK = _ref2.PKESK;

  C = require('../const').openpgp;

  SHA512 = require('../hash').SHA512;

  encode = require('./armor').encode;

  clearsign = require('./clearsign');

  Burner = (function() {
    function Burner(_arg) {
      this.literals = _arg.literals, this.signing_key = _arg.signing_key, this.encryption_key = _arg.encryption_key;
      this.packets = [];
      this.signed_payload = null;
    }

    Burner.prototype._frame_literals = function(cb) {
      var esc, l, p, sp, ___iced_passed_deferral, __iced_deferrals, __iced_k;
      __iced_k = __iced_k_noop;
      ___iced_passed_deferral = iced.findDeferral(arguments);
      esc = make_esc(cb, "Burner::_frame_literals");
      sp = [];
      (function(_this) {
        return (function(__iced_k) {
          var _i, _len, _ref3, _results, _while;
          _ref3 = _this.literals;
          _len = _ref3.length;
          _i = 0;
          _results = [];
          _while = function(__iced_k) {
            var _break, _continue, _next;
            _break = function() {
              return __iced_k(_results);
            };
            _continue = function() {
              return iced.trampoline(function() {
                ++_i;
                return _while(__iced_k);
              });
            };
            _next = function(__iced_next_arg) {
              _results.push(__iced_next_arg);
              return _continue();
            };
            if (!(_i < _len)) {
              return _break();
            } else {
              l = _ref3[_i];
              sp.push(l.to_signature_payload());
              (function(__iced_k) {
                __iced_deferrals = new iced.Deferrals(__iced_k, {
                  parent: ___iced_passed_deferral,
                  filename: "/Users/max/src/keybase/kbpgp/src/openpgp/burner.iced",
                  funcname: "Burner._frame_literals"
                });
                l.write(esc(__iced_deferrals.defer({
                  assign_fn: (function() {
                    return function() {
                      return p = arguments[0];
                    };
                  })(),
                  lineno: 43
                })));
                __iced_deferrals._fulfill();
              })(function() {
                return _next(_this.packets.push(p));
              });
            }
          };
          _while(__iced_k);
        });
      })(this)((function(_this) {
        return function() {
          _this.signed_payload = Buffer.concat(sp);
          return cb(null);
        };
      })(this));
    };

    Burner.prototype._sign = function(cb) {
      var err, esc, fp, ops, ops_framed, sig, ___iced_passed_deferral, __iced_deferrals, __iced_k;
      __iced_k = __iced_k_noop;
      ___iced_passed_deferral = iced.findDeferral(arguments);
      esc = make_esc(cb, "Burner::_sign'");
      ops = new OnePassSignature({
        sig_type: C.sig_types.binary_doc,
        hasher: SHA512,
        sig_klass: this.signing_key.get_klass(),
        key_id: this.signing_key.get_key_id(),
        is_final: 1
      });
      (function(_this) {
        return (function(__iced_k) {
          __iced_deferrals = new iced.Deferrals(__iced_k, {
            parent: ___iced_passed_deferral,
            filename: "/Users/max/src/keybase/kbpgp/src/openpgp/burner.iced",
            funcname: "Burner._sign"
          });
          ops.write(esc(__iced_deferrals.defer({
            assign_fn: (function() {
              return function() {
                return ops_framed = arguments[0];
              };
            })(),
            lineno: 59
          })));
          __iced_deferrals._fulfill();
        });
      })(this)((function(_this) {
        return function() {
          sig = new Signature({
            type: C.sig_types.binary_doc,
            key: _this.signing_key.key,
            hashed_subpackets: [new CreationTime(unix_time())],
            unhashed_subpackets: [new Issuer(_this.signing_key.get_key_id())]
          });
          (function(__iced_k) {
            __iced_deferrals = new iced.Deferrals(__iced_k, {
              parent: ___iced_passed_deferral,
              filename: "/Users/max/src/keybase/kbpgp/src/openpgp/burner.iced",
              funcname: "Burner._sign"
            });
            sig.write(_this.signed_payload, __iced_deferrals.defer({
              assign_fn: (function() {
                return function() {
                  err = arguments[0];
                  return fp = arguments[1];
                };
              })(),
              lineno: 66
            }));
            __iced_deferrals._fulfill();
          })(function() {
            if (typeof err === "undefined" || err === null) {
              _this.packets.unshift(ops_framed);
              _this.packets.push(fp);
            }
            return cb(err);
          });
        };
      })(this));
    };

    Burner.prototype.collect_packets = function() {
      var ret;
      ret = Buffer.concat(this.packets);
      this.packets = [];
      return ret;
    };

    Burner.prototype._compress = function(cb) {
      var err, inflated, opkt, pkt, ___iced_passed_deferral, __iced_deferrals, __iced_k;
      __iced_k = __iced_k_noop;
      ___iced_passed_deferral = iced.findDeferral(arguments);
      inflated = this.collect_packets();
      pkt = new Compressed({
        algo: C.compression.zlib,
        inflated: inflated
      });
      (function(_this) {
        return (function(__iced_k) {
          __iced_deferrals = new iced.Deferrals(__iced_k, {
            parent: ___iced_passed_deferral,
            filename: "/Users/max/src/keybase/kbpgp/src/openpgp/burner.iced",
            funcname: "Burner._compress"
          });
          pkt.write(__iced_deferrals.defer({
            assign_fn: (function() {
              return function() {
                err = arguments[0];
                return opkt = arguments[1];
              };
            })(),
            lineno: 84
          }));
          __iced_deferrals._fulfill();
        });
      })(this)((function(_this) {
        return function() {
          if (typeof err === "undefined" || err === null) {
            _this.packets.push(opkt);
          }
          return cb(err);
        };
      })(this));
    };

    Burner.prototype._make_session_key = function(cb) {
      var ___iced_passed_deferral, __iced_deferrals, __iced_k;
      __iced_k = __iced_k_noop;
      ___iced_passed_deferral = iced.findDeferral(arguments);
      this._cipher_algo = C.symmetric_key_algorithms.AES256;
      this._cipher_info = get_cipher(this._cipher_algo);
      (function(_this) {
        return (function(__iced_k) {
          __iced_deferrals = new iced.Deferrals(__iced_k, {
            parent: ___iced_passed_deferral,
            filename: "/Users/max/src/keybase/kbpgp/src/openpgp/burner.iced",
            funcname: "Burner._make_session_key"
          });
          SRF().random_bytes(_this._cipher_info.key_size, __iced_deferrals.defer({
            assign_fn: (function(__slot_1) {
              return function() {
                return __slot_1._session_key = arguments[0];
              };
            })(_this),
            lineno: 94
          }));
          __iced_deferrals._fulfill();
        });
      })(this)((function(_this) {
        return function() {
          _this._cipher = new _this._cipher_info.klass(WordArray.from_buffer(_this._session_key));
          return cb(null);
        };
      })(this));
    };

    Burner.prototype.scrub = function() {
      if (this._cipher != null) {
        this._cipher.scrub();
      }
      if (this._session_key != null) {
        return scrub_buffer(this._session_key);
      }
    };

    Burner.prototype._encrypt_session_key = function(cb) {
      var ekey, err, k, payload, pkt, ___iced_passed_deferral, __iced_deferrals, __iced_k;
      __iced_k = __iced_k_noop;
      ___iced_passed_deferral = iced.findDeferral(arguments);
      payload = export_key_pgp(this._cipher_algo, this._session_key);
      k = this.encryption_key.key;
      (function(_this) {
        return (function(__iced_k) {
          __iced_deferrals = new iced.Deferrals(__iced_k, {
            parent: ___iced_passed_deferral,
            filename: "/Users/max/src/keybase/kbpgp/src/openpgp/burner.iced",
            funcname: "Burner._encrypt_session_key"
          });
          k.pad_and_encrypt(payload, __iced_deferrals.defer({
            assign_fn: (function() {
              return function() {
                err = arguments[0];
                return ekey = arguments[1];
              };
            })(),
            lineno: 109
          }));
          __iced_deferrals._fulfill();
        });
      })(this)((function(_this) {
        return function() {
          (function(__iced_k) {
            if (typeof err === "undefined" || err === null) {
              pkt = new PKESK({
                crypto_type: k.type,
                key_id: _this.encryption_key.get_key_id(),
                ekey: ekey
              });
              (function(__iced_k) {
                __iced_deferrals = new iced.Deferrals(__iced_k, {
                  parent: ___iced_passed_deferral,
                  filename: "/Users/max/src/keybase/kbpgp/src/openpgp/burner.iced",
                  funcname: "Burner._encrypt_session_key"
                });
                pkt.write(__iced_deferrals.defer({
                  assign_fn: (function(__slot_1) {
                    return function() {
                      err = arguments[0];
                      return __slot_1._pkesk = arguments[1];
                    };
                  })(_this),
                  lineno: 116
                }));
                __iced_deferrals._fulfill();
              })(__iced_k);
            } else {
              return __iced_k();
            }
          })(function() {
            return cb(err);
          });
        };
      })(this));
    };

    Burner.prototype._encrypt_payload = function(cb) {
      var esc, pkt, plaintext, prefixrandom, ___iced_passed_deferral, __iced_deferrals, __iced_k;
      __iced_k = __iced_k_noop;
      ___iced_passed_deferral = iced.findDeferral(arguments);
      esc = make_esc(cb, "Burner::_encrypt_payload");
      plaintext = this.collect_packets();
      (function(_this) {
        return (function(__iced_k) {
          __iced_deferrals = new iced.Deferrals(__iced_k, {
            parent: ___iced_passed_deferral,
            filename: "/Users/max/src/keybase/kbpgp/src/openpgp/burner.iced",
            funcname: "Burner._encrypt_payload"
          });
          SRF().random_bytes(_this._cipher.blockSize, __iced_deferrals.defer({
            assign_fn: (function() {
              return function() {
                return prefixrandom = arguments[0];
              };
            })(),
            lineno: 124
          }));
          __iced_deferrals._fulfill();
        });
      })(this)((function(_this) {
        return function() {
          pkt = new SEIPD({});
          (function(__iced_k) {
            __iced_deferrals = new iced.Deferrals(__iced_k, {
              parent: ___iced_passed_deferral,
              filename: "/Users/max/src/keybase/kbpgp/src/openpgp/burner.iced",
              funcname: "Burner._encrypt_payload"
            });
            pkt.encrypt({
              cipher: _this._cipher,
              plaintext: plaintext,
              prefixrandom: prefixrandom
            }, esc(__iced_deferrals.defer({
              lineno: 126
            })));
            __iced_deferrals._fulfill();
          })(function() {
            (function(__iced_k) {
              __iced_deferrals = new iced.Deferrals(__iced_k, {
                parent: ___iced_passed_deferral,
                filename: "/Users/max/src/keybase/kbpgp/src/openpgp/burner.iced",
                funcname: "Burner._encrypt_payload"
              });
              pkt.write(esc(__iced_deferrals.defer({
                assign_fn: (function() {
                  return function() {
                    return pkt = arguments[0];
                  };
                })(),
                lineno: 127
              })));
              __iced_deferrals._fulfill();
            })(function() {
              scrub_buffer(plaintext);
              _this.packets = [_this._pkesk, pkt];
              return cb(null);
            });
          });
        };
      })(this));
    };

    Burner.prototype._encrypt = function(cb) {
      var esc, ___iced_passed_deferral, __iced_deferrals, __iced_k;
      __iced_k = __iced_k_noop;
      ___iced_passed_deferral = iced.findDeferral(arguments);
      esc = make_esc(cb, "Burner::_encrypt");
      (function(_this) {
        return (function(__iced_k) {
          __iced_deferrals = new iced.Deferrals(__iced_k, {
            parent: ___iced_passed_deferral,
            filename: "/Users/max/src/keybase/kbpgp/src/openpgp/burner.iced",
            funcname: "Burner._encrypt"
          });
          _this._make_session_key(esc(__iced_deferrals.defer({
            lineno: 136
          })));
          __iced_deferrals._fulfill();
        });
      })(this)((function(_this) {
        return function() {
          (function(__iced_k) {
            __iced_deferrals = new iced.Deferrals(__iced_k, {
              parent: ___iced_passed_deferral,
              filename: "/Users/max/src/keybase/kbpgp/src/openpgp/burner.iced",
              funcname: "Burner._encrypt"
            });
            _this._encrypt_session_key(esc(__iced_deferrals.defer({
              lineno: 137
            })));
            __iced_deferrals._fulfill();
          })(function() {
            (function(__iced_k) {
              __iced_deferrals = new iced.Deferrals(__iced_k, {
                parent: ___iced_passed_deferral,
                filename: "/Users/max/src/keybase/kbpgp/src/openpgp/burner.iced",
                funcname: "Burner._encrypt"
              });
              _this._encrypt_payload(esc(__iced_deferrals.defer({
                lineno: 138
              })));
              __iced_deferrals._fulfill();
            })(function() {
              return cb(null);
            });
          });
        };
      })(this));
    };

    Burner.prototype.scrub = function() {};

    Burner.prototype.burn = function(cb) {
      var esc, output, ___iced_passed_deferral, __iced_deferrals, __iced_k;
      __iced_k = __iced_k_noop;
      ___iced_passed_deferral = iced.findDeferral(arguments);
      esc = make_esc(cb, "Burner::burn");
      (function(_this) {
        return (function(__iced_k) {
          __iced_deferrals = new iced.Deferrals(__iced_k, {
            parent: ___iced_passed_deferral,
            filename: "/Users/max/src/keybase/kbpgp/src/openpgp/burner.iced",
            funcname: "Burner.burn"
          });
          _this._frame_literals(esc(__iced_deferrals.defer({
            lineno: 149
          })));
          __iced_deferrals._fulfill();
        });
      })(this)((function(_this) {
        return function() {
          (function(__iced_k) {
            if (_this.signing_key) {
              (function(__iced_k) {
                __iced_deferrals = new iced.Deferrals(__iced_k, {
                  parent: ___iced_passed_deferral,
                  filename: "/Users/max/src/keybase/kbpgp/src/openpgp/burner.iced",
                  funcname: "Burner.burn"
                });
                _this._sign(esc(__iced_deferrals.defer({
                  lineno: 151
                })));
                __iced_deferrals._fulfill();
              })(__iced_k);
            } else {
              return __iced_k();
            }
          })(function() {
            (function(__iced_k) {
              __iced_deferrals = new iced.Deferrals(__iced_k, {
                parent: ___iced_passed_deferral,
                filename: "/Users/max/src/keybase/kbpgp/src/openpgp/burner.iced",
                funcname: "Burner.burn"
              });
              _this._compress(esc(__iced_deferrals.defer({
                lineno: 152
              })));
              __iced_deferrals._fulfill();
            })(function() {
              (function(__iced_k) {
                if (_this.encryption_key) {
                  (function(__iced_k) {
                    __iced_deferrals = new iced.Deferrals(__iced_k, {
                      parent: ___iced_passed_deferral,
                      filename: "/Users/max/src/keybase/kbpgp/src/openpgp/burner.iced",
                      funcname: "Burner.burn"
                    });
                    _this._encrypt(esc(__iced_deferrals.defer({
                      lineno: 154
                    })));
                    __iced_deferrals._fulfill();
                  })(__iced_k);
                } else {
                  return __iced_k();
                }
              })(function() {
                output = Buffer.concat(_this.packets);
                return cb(null, output);
              });
            });
          });
        };
      })(this));
    };

    return Burner;

  })();

  exports.Burner = Burner;

  exports.make_simple_literals = make_simple_literals = function(msg) {
    return [
      new Literal({
        data: new Buffer(msg),
        format: C.literal_formats.utf8,
        date: unix_time()
      })
    ];
  };

  exports.clearsign = clearsign.sign;

  exports.burn = function(_arg, cb) {
    var aout, b, encryption_key, err, literals, msg, raw, signing_key, ___iced_passed_deferral, __iced_deferrals, __iced_k;
    __iced_k = __iced_k_noop;
    ___iced_passed_deferral = iced.findDeferral(arguments);
    msg = _arg.msg, literals = _arg.literals, signing_key = _arg.signing_key, encryption_key = _arg.encryption_key;
    if ((msg != null) && (literals == null)) {
      literals = make_simple_literals(msg);
    }
    b = new Burner({
      literals: literals,
      signing_key: signing_key,
      encryption_key: encryption_key
    });
    (function(_this) {
      return (function(__iced_k) {
        __iced_deferrals = new iced.Deferrals(__iced_k, {
          parent: ___iced_passed_deferral,
          filename: "/Users/max/src/keybase/kbpgp/src/openpgp/burner.iced",
          funcname: "burn"
        });
        b.burn(__iced_deferrals.defer({
          assign_fn: (function() {
            return function() {
              err = arguments[0];
              return raw = arguments[1];
            };
          })(),
          lineno: 203
        }));
        __iced_deferrals._fulfill();
      });
    })(this)((function(_this) {
      return function() {
        b.scrub();
        if ((typeof raw !== "undefined" && raw !== null) && (typeof err === "undefined" || err === null)) {
          aout = encode(C.message_types.generic, raw);
        }
        return cb(err, aout, raw);
      };
    })(this));
  };

}).call(this);
