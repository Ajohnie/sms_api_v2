@echo off
firebase emulators:start --only functions,firestore,auth,storage --import ./data1 --export-on-exit
rem firebase emulators:start --only functions,firestore,auth,storage --import ./backups --export-on-exit

