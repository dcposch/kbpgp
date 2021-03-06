
C = require('../../const').openpgp
triplesec = require 'triplesec'
{SHA1,SHA256} = triplesec.hash
RSA = require('../../rsa').Pair
DSA = require('../../dsa').Pair
ElGamal = require('../../elgamal').Pair
ElGamalSE = require('../../elgamalse').Pair
{AES} = triplesec.ciphers
{native_rng} = triplesec.prng
{calc_checksum} = require '../util'
{bufferify,unix_time,bufeq_secure,katch,make_time_packet,uint_to_buffer} = require '../../util'
{decrypt,encrypt} = require '../cfb'
{Packet} = require './base'
S = require './signature'
{Signature} = S
{encode} = require '../armor'
{S2K,SecretKeyMaterial} = require '../s2k'
symmetric = require '../../symmetric'
util = require 'util'
packetsigs = require './packetsigs'

#=================================================================================

FUCK = 0

class KeyMaterial extends Packet

  # 
  # @param {Pair} key a Keypair that can be used for signing, etc.
  # @param {number} timestamp Uint32 saying what time the key was born
  # @param {string|Buffer} passphrase The passphrase used to lock the key
  # @param {SecretKeyMaterial} skm A wrapper around the {S2K} object; 
  #                  the encryption engine used to lock the secret parts of the key
  # @param {Object} opts a list of options
  # @param {number} flags The flags to grant this key
  # @option opts {bool} subkey True if this is a subkey
  constructor : ({@key, @timestamp, @passphrase, @skm, @opts, @flags}) ->
    @opts or= {}
    @flags or= 0
    @cnt = FUCK++
    super()

  #--------------------------

  _write_private_enc : (bufs, priv, pp) ->
    bufs.push new Buffer [ 
      C.s2k_convention.sha1,                  # Indicates s2k with SHA1 checksum
      C.symmetric_key_algorithms.AES256,      # Sym algo used to encrypt
      C.s2k.salt_iter,                        # s2k salt+iterative
      C.hash_algorithms.SHA256                # s2k hash algo
    ]
    sha1hash = (new SHA1).bufhash priv        # checksum of the cleartext MPIs
    salt = native_rng 8                       # 8 bytes of salt
    bufs.push salt 
    c = 96
    bufs.push new Buffer [ c ]                # ??? translates to a count of 65336 ???
    ks = AES.keySize
    k = (new S2K).write pp, salt, c, ks       # expanded encryption key (via s2k)
    ivlen = AES.blockSize                     # ivsize = msgsize
    iv = native_rng ivlen                     # Consider a truly random number in the future
    bufs.push iv                              # push the IV on before the ciphertext

    # horrible --- 'MAC' then encrypt :(
    plaintext = Buffer.concat [ priv, sha1hash ]   

    # Encrypt with CFB/mode + AES.  Use the expanded key from s2k
    ct = encrypt { block_cipher_class : AES, key : k, plaintext, iv } 

    bufs.push ct

  #--------------------------

  _write_private_clear : (bufs, priv) ->
    bufs.push(
      new Buffer([C.s2k_convention.none]),
      priv,
      uint_to_buffer(16, calc_checksum(priv))
    )

  #--------------------------

  _write_public : (bufs) ->
    pub = @key.serialize()
    bufs.push(
      new Buffer([ C.versions.keymaterial.V4 ]),   # Since PGP 5.x, this is prefered version
      uint_to_buffer(32, @timestamp),
      new Buffer([ @key.type ]),
      pub
    )

  #--------------------------

  _write_dummy : (bufs) ->
    bufs.push(
      new Buffer([
        C.s2k_convention.sha1               # dummy, pro-forma
        C.symmetric_key_algorithms.AES256   # dummy, pro-forma
        C.s2k.gnu                           # The GNU s2k param
        0x2                                 # Not sure, maybe a version #?
      ]),
      new Buffer("GNU", "utf8"),            # The "GNU" ascii art goes next
      new Buffer([ 0x1 ])                   # Finally, 0x1 means "dummy"
    )

  #--------------------------

  add_flags : (v) -> @flags |= v

  #--------------------------
  
  private_body : (opts) ->
    bufs = []
    @_write_public bufs
    priv = if (p = @key.priv)? then p.serialize() else null
    pp = opts.passphrase or @passphrase

    if not priv? then @_write_dummy         bufs
    else if pp?  then @_write_private_enc   bufs, priv, pp
    else              @_write_private_clear bufs, priv

    ret = Buffer.concat bufs
    ret

  #--------------------------

  private_framed : (opts) ->
    body = @private_body opts
    T = C.packet_tags
    tag = if opts.subkey then T.secret_subkey else T.secret_key
    @frame_packet tag, body

  #--------------------------

  public_body : () ->
    bufs = []
    @_write_public bufs
    Buffer.concat bufs

  #--------------------------

  get_fingerprint : () ->
    data = @public_body()
    (new SHA1).bufhash Buffer.concat [
      new Buffer([ C.signatures.key ]),
      uint_to_buffer(16, data.length),
      data
    ]

  #--------------------------

  get_key_id : () -> @get_fingerprint()[12...20]
  get_short_key_id : () -> @get_key_id()[-4...].toString('hex').toUpperCase()

  #--------------------------

  get_klass : () -> @key.constructor

  #--------------------------

  export_framed : (opts = {}) ->
    if opts.private then @private_framed opts
    else @public_framed opts

  #--------------------------
  
  public_framed : (opts = {}) ->
    body = @public_body()
    T = C.packet_tags
    tag = if opts.subkey then T.public_subkey else T.public_key
    @frame_packet tag, body

  #--------------------------

  to_signature_payload : () ->
    pk = @public_body()

    # RFC 4880 5.2.4 Computing Signatures Over a Key
    Buffer.concat [
      new Buffer([ C.signatures.key ] ),
      uint_to_buffer(16, pk.length),
      pk
    ]

  #--------------------------

  self_sign_key : ({userids, lifespan, raw_payload}, cb) ->
    err = null
    sigs = []
    for userid in userids when not err?
      sig = null
      if @key.can_sign() or raw_payload
        await @_self_sign_key { userid, lifespan, raw_payload }, defer err, sig
      else if not (userid.get_framed_signature_output())?
        err = new Error "Cannot sign key --- don't have a private key, and can't replay"
      sigs.push sig
    cb err, sig

  #--------------------------

  _self_sign_key : ( {userid, lifespan, raw_payload}, cb) ->
    payload = Buffer.concat [ @to_signature_payload(), userid.to_signature_payload() ]

    # XXX Todo -- Implement Preferred Compression Algorithm --- See Issue #16
    type = C.sig_types.positive
    
    hsp = [
      new S.CreationTime(lifespan.generated)
      new S.KeyFlags([@flags])
      new S.PreferredSymmetricAlgorithms([C.symmetric_key_algorithms.AES256, C.symmetric_key_algorithms.AES128])
      new S.PreferredHashAlgorithms([C.hash_algorithms.SHA512, C.hash_algorithms.SHA256])
      new S.Features([C.features.modification_detection])
      new S.KeyServerPreferences([C.key_server_preferences.no_modify])   
    ]

    if lifespan.expire_in
      hsp.push new S.KeyExpirationTime(lifespan.expire_in)

    sig = new Signature { 
      type : type,
      key : @key,
      hashed_subpackets : hsp,
      unhashed_subpackets : [ new S.Issuer(@get_key_id()) ]
    }
 
    # raw_payload is when we want to just output what would have been signed without actually
    # signing it.  We need this for patching keys in the client.   
    if raw_payload
      sig = payload
    else
      # We just store the output in the signature object itself 
      await sig.write payload, defer err

      ps = new packetsigs.SelfSig { userid, type, sig, options : @flags }
      userid.push_sig ps
      @push_sig ps

    cb err, sig

  #--------------------------

  sign_subkey : ({subkey, lifespan}, cb) ->
    err = sig = null
    if @key.can_sign() and subkey.key.can_sign()
      await @_sign_subkey { subkey, lifespan }, defer err
    else if not (subkey.get_subkey_binding()?.sig?.get_framed_output())
      err = new Error "Cannot sign key --- don't have private key and can't replay"
    cb err

  #--------------------------

  _sign_subkey : ({subkey, lifespan}, cb) ->
    sig = err = null
    await subkey._sign_primary_with_subkey { primary : @, lifespan }, defer err, primary_binding
    unless err?
      await @_sign_subkey_with_primary { subkey, lifespan, primary_binding }, defer err, sig
    unless err?
      SKB = packetsigs.SubkeyBinding
      ps = new SKB { primary : @, sig, direction : SKB.DOWN } 
      subkey.push_sig ps
    cb err

  #--------------------------

  _sign_primary_with_subkey : ({primary, lifespan}, cb) ->
    payload = Buffer.concat [ primary.to_signature_payload(), @to_signature_payload() ]
    sig = new Signature {
      type : C.sig_types.primary_binding
      key : @key
      hashed_subpackets : [
        new S.CreationTime(lifespan.generated)
      ],
      unhashed_subpackets : [
        new S.Issuer(@get_key_id())
      ]}
      
    # We put these as signature subpackets, so we don't want to frame them;
    # they already come with framing as a result of their placement in
    # the signature.  This is a bit of a hack, but it's OK for now.
    await sig.write_unframed payload, defer err, sig_unframed
    cb err, sig_unframed

  #--------------------------

  _sign_subkey_with_primary : ({subkey, lifespan, primary_binding}, cb) ->
    payload = Buffer.concat [ @to_signature_payload(), subkey.to_signature_payload() ]
    sig = new Signature {
      type : C.sig_types.subkey_binding
      key : @key
      hashed_subpackets : [
        new S.CreationTime(lifespan.generated)
        new S.KeyExpirationTime(lifespan.expire_in)
        new S.KeyFlags([subkey.flags])
      ],
      unhashed_subpackets : [
        new S.Issuer(@get_key_id()),
        new S.EmbeddedSignature { rawsig : primary_binding }
      ]}
      
    await sig.write payload, defer err
    cb err, sig

  #--------------------------

  merge_private : (k2) -> 
    @skm = k2.skm

  #--------------------------

  @parse_public_key : (slice, opts) -> (new Parser slice).parse_public_key opts

  #--------------------------

  @parse_private_key : (slice, opts) -> (new Parser slice).parse_private_key opts
  
  #--------------------------

  is_key_material : () -> true
  is_primary : -> not @opts?.subkey
  ekid : () -> @key.ekid()
  can_sign : () -> @key.can_sign()
  is_locked : () -> (not @key.has_private()) and @skm? and @skm.is_locked()

  has_private : () -> @has_unlocked_private() or @has_locked_private()
  has_locked_private : () -> (@skm and @skm.has_private())
  has_unlocked_private : () -> @key.has_private()
  has_secret_key_material : () -> @skm?

  #--------------------------

  is_signed_subkey_of : (primary) ->
    ((not @primary_flag) and @get_psc().is_signed_subkey_of primary)

  get_subkey_binding : () ->
    if @opts.subkey then @get_psc().get_subkey_binding() else null
  get_subkey_binding_signature_output : () ->
    @get_subkey_binding()?.sig?.get_framed_output()

  #--------------------------

  equal : (k2) -> bufeq_secure @ekid(), k2.ekid()

  #--------------------------

  # Open an OpenPGP key packet using the given passphrase
  #
  # @param {string} passphrase the passphrase in uft8
  # 
  unlock : ({passphrase}, cb) ->
    passphrase = bufferify passphrase
    err = null

    unless @skm?
      err = new Error "Cannot unlock secret key -- no material!"
      return cb err

    pt = if @skm.s2k_convention is C.s2k_convention.none then @skm.payload
    else if (@skm.s2k.type is C.s2k.gnu_dummy) then null # no need to do anything here
    else 
      key = @skm.s2k.produce_key passphrase, @skm.cipher.key_size
      decrypt { 
        ciphertext : @skm.payload,
        block_cipher_class : @skm.cipher.klass, 
        iv : @skm.iv, 
        key : key }

    if pt
      switch @skm.s2k_convention
        when C.s2k_convention.sha1
          end = pt.length - SHA1.output_size
          h1 = pt[end...]
          pt = pt[0...end]
          h2 = (new SHA1).bufhash pt
          err = new Error "hash mismatch" unless bufeq_secure(h1, h2)
        when C.s2k_convention.checksum, C.s2k_convention.none
          end = pt.length - 2
          c1 = pt.readUInt16BE end
          pt = pt[0...end]
          c2 = calc_checksum pt
          err = new Error "checksum mismatch" unless c1 is c2
      err = @key.read_priv(pt) unless err?

    cb err

  #-------------------

  get_all_key_flags    : ()      -> @_psc.get_all_key_flags()
  add_flags            : (v)     -> @flags |= v

  #-------------------

  fulfills_flags : (flags) -> 
    ((@get_all_key_flags() & flags) is flags) or @key.fulfills_flags(flags)

  get_signed_userids         : () -> @get_psc().get_signed_userids()
  get_signed_user_attributes : () -> @get_psc().get_signed_user_attributes()
  is_self_signed             : () -> @get_psc().is_self_signed()

  #-------------------

  push_sig : (packetsig) ->
    @add_flags packetsig.sig.get_key_flags()
    super packetsig

#=================================================================================

class Parser

  #-------------------
  
  constructor : (@slice) ->
    @key = null

  #-------------------

  parse_public_key_v3 : () ->
    @timestamp = @slice.read_uint32()
    @expiration = @slice.read_uint16()
    @parse_public_key_mpis()

  #-------------------
  
  parse_public_key_v4 : () ->
    @timestamp = @slice.read_uint32()
    @parse_public_key_mpis()

  #-------------------
  
  parse_public_key_mpis: () ->
    @algorithm = @slice.read_uint8()
    A = C.public_key_algorithms
    klass = switch @algorithm 
      when A.RSA, A.RSA_ENCRYPT_ONLY, A.RSA_SIGN_ONLY then RSA
      when A.DSA then DSA
      when A.ELGAMAL then ElGamal
      when A.ELGAMAL_SIGN_AND_ENCRYPT then ElGamalSE
      else throw new Error "Unknown key type: #{@algorithm}"
    [err, key, len] = klass.parse @slice.peek_rest_to_buffer()
    throw err if err?
    @slice.advance len
    key

  #-------------------
  
  # 5.5.2 Public-Key Packet Formats
  _parse_public_key : () ->
    switch (version = @slice.read_uint8())
      when C.versions.keymaterial.V3 then @parse_public_key_v3()
      when C.versions.keymaterial.V4 then @parse_public_key_v4()
      else throw new Error "Unknown public key version: #{version}"

  #-------------------
  
  parse_public_key : (opts) ->
    key = @_parse_public_key()
    new KeyMaterial { key, @timestamp, opts}

  #-------------------

  # 5.5.3.  Secret-Key Packet Formats
  #
  # See read_priv_key in openpgp.packet.keymaterial.js
  #
  parse_private_key : (opts) ->
    skm = new SecretKeyMaterial()
    key = @_parse_public_key()

    encrypted_private_key = true
    sym_enc_alg = null

    if (skm.s2k_convention = @slice.read_uint8()) is C.s2k_convention.none 
      encrypted_private_key = false
    else 
      if skm.s2k_convention in [ C.s2k_convention.sha1, C.s2k_convention.checksum ]
        sym_enc_alg = @slice.read_uint8()
        skm.s2k = (new S2K).read @slice
      else sym_enc_alg = skm.s2k_convention

    # There's a special GNU convention for showing that this key wasn't included.
    # This comes up when you export secret subkeys but keep the master key
    # hidden.
    if (skm.s2k_convention isnt C.s2k_convention.none) and (skm.s2k.type is C.s2k.gnu_dummy)
      skm.payload = null
    else 
      if sym_enc_alg
        skm.cipher = symmetric.get_cipher sym_enc_alg
        iv_len = skm.cipher.klass.blockSize
        skm.iv = @slice.read_buffer iv_len
      skm.payload = @slice.consume_rest_to_buffer()

    new KeyMaterial { key, skm, @timestamp, opts }

#=================================================================================

exports.KeyMaterial = KeyMaterial

#=================================================================================

