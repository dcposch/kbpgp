K = require('../const').kb
{alloc,SHA256} = require '../hash'
purepack = require 'purepack'
{katch,obj_extract,bufeq_secure} = require '../util'

#=================================================================================

null_hash = new Buffer(0)

pack   = (x) -> purepack.pack   x, { sort_keys : true }
unpack = (x) -> purepack.unpack x

#=================================================================================

box = ({type, obj}) ->
  hasher = SHA256
  oo = 
    version : K.versions.V1 
    type : type
    body : obj
    hash : 
      type : hasher.type
      value : null_hash
  packed = pack oo
  oo.hash.value = hasher packed
  pack oo

#=================================================================================

unbox = (buf) ->
  katch () ->
    oo = unpack buf # throws an error if there's a problem
    throw new Error "missing obj.hash.value" unless (hv = oo?.hash?.value)?
    oo.hash.value = null_hash
    hasher = alloc (t = oo.hash.type)
    throw new Error "unknown hash algo: #{t}" unless hasher?
    h = hasher pack oo
    throw new Error "hash mismatch" unless bufeq_secure(h, hv)
    throw new Error "unknown version" unless oo.version is K.versions.V1
    obj_extract oo, [ 'type', 'body' ]

#=================================================================================

exports.box = box
exports.pack = pack
exports.unbox = unbox
exports.decode = decode
