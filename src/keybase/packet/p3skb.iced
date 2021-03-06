K = require('../../const').kb
triplesec = require 'triplesec'
{SHA512} = require '../../hash'
{Decryptor} = triplesec
{native_rng} = triplesec.prng
{Packet} = require './base'
{pack,box} = require '../encode'
{make_esc} = require 'iced-error'
rsa = require '../../rsa'
{sign,verify} = require '../sign'
{bufeq_secure,bufferify} = require '../../util'

#=================================================================================

# PGP Triplesec Secret Key Bundle
class P3SKB extends Packet

  constructor : ({@pub,priv_clear,priv}) ->
    super()
    @priv = if priv? then priv 
    else if priv_clear? then { data : priv_clear, encryption : K.key_encryption.none }

  frame_packet : () ->
    super K.packet_tags.p3skb, { @pub, @priv }

  lock : ({asp, tsenc}, cb) ->
    await tsenc.run { data : @priv.data, progress_hook : asp?.progress_hook() }, defer err, ct
    unless err?
      @priv.data = ct
      @priv.encryption = K.key_encryption.triplesec_v3
    cb err

  unlock : ({asp, tsenc}, cb) ->
    switch @priv.encryption
      when K.key_encryption.triplesec_v3, K.key_encryption.triplesec_v2, K.key_encryption.triplesec_v1
        dec = new Decryptor { enc : tsenc }
        progress_hook = asp?.progress_hook()
        await dec.run { data : @priv.data, progress_hook }, defer err, raw
        dec.scrub()
        unless err?
          @priv.data = raw
          @priv.encryption = K.key_encryption.none
      when K.key_encryption.none then # noop
      else 
        err = new Error "Unknown key encryption type: #{k.encryption}"
    cb err

  @alloc : ({tag,body}) ->
    if tag is K.packet_tags.p3skb then new P3SKB body
    else throw new Error "wrong tag found: #{tag}"

  @alloc_nothrow : (obj) -> katch () -> P3SKB.alloc obj

  has_private : () -> @priv?
  is_locked : () -> @priv.encryption isnt K.key_encryption.none

#=================================================================================

exports.P3SKB = P3SKB
