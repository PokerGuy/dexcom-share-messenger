#!/bin/bash
cd /home/evan/static/dexcom-share-client
git pull origin master
npm update
cp /home/evan/static/dexcom-share-client/src/components/production.js constants.js
rm -rf dist
grunt build