# sms_api

## About

# firebase functions for sms_api-app

## Deployment

# change values under lib/environment.ts and lib/environment.prod.ts
# change values under src/new-fire-base.ts to the target environment
# change values under build.bat and deploy.bat to project-names in your firebase configurations
# run build.bat to build the project
# delete firebase-export-* folders do reduce upload size
# run deploy.bat, select the appropriate project to deploy to your target environment

## Deployment --rules and indexes
# run export-indexes.cmd
# copy indexes to webclient
# run firebase init
# firebase deploy --only firestore

## Exporting from production to emulator
-- https://medium.com/firebase-developers/how-to-import-production-data-from-cloud-firestore-to-the-local-emulator-e82ae1c6ed8

## Creating reports in jasper report studio
-- table footer presented the biggest challenge
-- create it outside the table instead and align with the table
-- compute all data needed and pass it as report params