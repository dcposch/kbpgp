## 0.0.11

Bugfixes:

  - Finish support for v3 Signatures, and close #34
  - Fix bug in Revocation Key sub packets (type=12), in which we weren't reading in any bytes of the signature.

Features

  - Support signature type 0x1F ("signature directly on a key")
  - Support signature type 0x28 ("Subkey revocation"). See keybase/keybase-issues#27

## 0.0.10 (2014-2-21)

Bugifxes:

  - Upgrade to pgp-utils v0.0.14 to close keybase/node-client#106

## 0.0.9 (2014-2-21)

Bugfixes:

  - Upgrade to triplesec v3.0.6 for windows IE 11 support

## 0.0.8 (2014-2-20)

Bugfixes:

  - Close keybase/keybase-issues#11 - Signatures certification revocations

## 0.0.7

Features:

  - DSA and ElGamal support

## 0.0.5 (2014-2-14)

Bugfixes:

   - Fixed a bug with validating clearsign signatures, which was causing the
     crypto form on the site to barf on them, if they were generated from
     the CLI

Features:

   - Inaugural Changelog!