#!/bin/bash
cd /home/evan/static/dexcom-share-client
git pull origin master
npm update
cp /home/evan/static/dexcom-share-client/src/componentes/production.js constants.js
grunt build