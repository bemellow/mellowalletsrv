# Changelog

All notable changes to this project will be documented in this file.

## [0.11.0] - 2019-06-28

### Added

- Some scripts to search for assests and send them to some specific address starting with a wallet phrase.
- An e2e test that send money to and address using the server and then return it (works for BTC, ETC, DAI).

### Changed

- Bitfinex price estimation, when failed (normally by rate limit) return the last known value.

- Limit the quantity of rows for history and global history. Depends on conf, currently 10 records.


### Removed



## [0.3.0] - 2019-01-11

### Added

-   First release supporting websockets.

### Changed

### Removed
