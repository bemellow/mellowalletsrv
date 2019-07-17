#!/usr/bin/env bash
git push prod master
git push prod release/0.13.0
pm2 deploy production update
