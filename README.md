# WalletSrv

## Introduction

This server implements the api necesary for a wallet to make transactions.
To access the swagger api description connect to: http://server\_host:server\_port/walletsrv/v1/

## Instalation

### Preparation

- checkout the repo
- run
    -   npm install
    -   npm run nodemon (to run in development mode)

On the production server we use node, pm2, nginx as proxy and a local git repo to 
do the deploy, the first time a server is used pm2 must be installed on the server and 
the git repo must be prepared.

We assume that we use the user home directory to store the git repo and the node daemon source code.
- Install your ssh certificate in authorized_keys on the server (you can use ssh-copy-id on your machine).
- Create the git repo:
```
ssh server
mkdir repo
cd repo
git init --bare .

```
- On the your machine add the production server as a remote (ex: walletsrv@SERVER_IP:repo) server 
in your git configuration.
- try yo push to the remote `git push prod master` or `git push prod release/XXX`
- run once `pm2 deploy prod setup` to setup the production server (check ecosystem.json for pm2 configuration stuff).
- We use dotenv for configuration, copy the config.env.example file to .env and set the variables accordingly and  
  copy the .env file to the production server users home directory.
  
 

### Deploy
 

To deploy run:
```
 git push prod master
 git push prod release/0.9.1
 pm2 deploy prod update
```

## Obs

We use patch-package to patch a small bug in scrypt library during npm install fase and to patch web3 types.

## Network configuration

### Name-service

Nameservice configuration requires two parameters:

1.  Name-service registrar address: `{NET}_NS_ADDRESS`
2.  Public resolver address: `{NET}_NS_PUB_RESOLVER`

As of 2019/april:

    ETH_NS_ADDRESS="0x314159265dD8dbb310642f98f50C066173C1259b"
    ETH_NS_PUB_RESOLVER="0xd3ddccdd3b25a8a7423b5bee360a42146eb4baf3"
    RSK_NS_ADDRESS="0x2acc95758f8b5f583470ba265eb685a8f45fc9d5"           (*)
    RSK_NS_PUB_RESOLVER="0x4efd25e3d348f8f25a14fb7655fba6f72edfe93a"      (**)

(\*) http://docs.rns.rifos.org/Architecture/Registry/
(\*\*) http://docs.rns.rifos.org/Architecture/Resolver/#content


