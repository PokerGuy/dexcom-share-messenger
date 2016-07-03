#!/bin/bash
cd /home/evan/dexcom-share-messenger
git pull origin master
npm update
forever restartall