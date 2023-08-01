@echo off
rem techjunction-dev.appspot.com
SET BUCKET_NAME=gs://techjunction-2021.appspot.com
SET PROJECT_ID=techjunction-2021
SET UPDATE_PROJECT_ID=>gcloud config set account %PROJECT_ID%
SET EXPORT_GS_CLOUD=gcloud projects add-iam-policy-binding %PROJECT_ID% --member serviceAccount:%PROJECT_ID%@appspot.gserviceaccount.com --role roles/datastore.importExportAdmin

SET EXPORT_GS_UTIL=gsutil iam ch serviceAccount:%PROJECT_ID%@appspot.gserviceaccount.com:admin %BUCKET_NAME%
rem gcloud auth login
rem gcloud components update
rem %UPDATE_PROJECT_ID%
%EXPORT_GS_CLOUD%
%EXPORT_GS_UTIL%

