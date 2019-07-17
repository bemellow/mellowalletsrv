#!/usr/bin/env bash
git push staging master
git push staging release/0.13.0
pm2 deploy staging update
