#!/bin/bash
cd /home/evan/static/dexcom-share-client
git pull origin master
npm update
grunt build