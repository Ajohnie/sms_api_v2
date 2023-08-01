rem @2021 ripple solutions(www.eripplesolutions.com), this software is free for use, modification and distribution provided you maintain this header and everything in it
@echo off
cd F:\PServer\api\NODE_PROJECTS\api_workspace\sms_api
echo enter action (allowed values are build, deploy, rules,indexes)
SET /P ACTION=

if %ACTION%=="" (
   goto end
)

goto %ACTION%
goto end

:build
SET BUILD=call emulate.bat
%BUILD%
goto end

:deploy
SET FB_PROJECT_KMP=kampala-model-primary
SET FB_PROJECT_ST_CLAVER=st-claver-primary
SET FB_PROJECT_BY_PASS=bypass-primary
SET FB_PROJECT_RIPPLE=ripple-sms-app
SET FB_PROJECT_DEMO=demonstration-primary

echo enter project (allowed values are kmp,stclaver,bypass,ripple,demo)

SET /P PROJECT=
SET /P FB_PROJECT=
SET /P COPY_CONFIG=
if %PROJECT%==kmp (
   SET FB_PROJECT=%FB_PROJECT_KMP%
   SET COPY_CONFIG=copy /Y .firebaserc-kmp .firebaserc
)
if %PROJECT%==stclaver (
   SET FB_PROJECT=%FB_PROJECT_ST_CLAVER%
   SET COPY_CONFIG=copy /Y .firebaserc-st-claver .firebaserc
)
if %PROJECT%==bypass (
   SET FB_PROJECT=%FB_PROJECT_BY_PASS%
   SET COPY_CONFIG=copy /Y .firebaserc-bypass .firebaserc
)
if %PROJECT%==ripple (
   SET FB_PROJECT=%FB_PROJECT_RIPPLE%
   SET COPY_CONFIG=copy /Y .firebaserc-ripple .firebaserc
)
if %PROJECT%==demo (
   SET FB_PROJECT=%FB_PROJECT_DEMO%
   SET COPY_CONFIG=copy /Y .firebaserc-demo .firebaserc
)
SET SET_PROJECT=firebase use %FB_PROJECT%
echo "deploying to only func:api, add other functions here of you have made modifications in them"
echo first change memory profile and environment variable to .prod
echo
echo
SET DEPLOY_PROJECT=firebase deploy --only functions:api
rem SET DEPLOY_PROJECT=firebase deploy --only functions
rem SET DEPLOY_PROJECT=firebase deploy --only functions:clearUserLog
rem SET DEPLOY_PROJECT=firebase deploy --only functions:api,functions:updateUserRoles,functions:updateUserAccounts,functions:processEmails,functions:clearUserLog
rem SET DEPLOY_PROJECT=firebase deploy --only functions:api,functions:updateUserRoles,functions:updateUserAccounts,functions:processEmails
rem SET DEPLOY_PROJECT=firebase deploy --only functions:api,functions:processEmails
rem SET DEPLOY_PROJECT=firebase deploy --only functions:api,clearResultsCache,updateExamAssociations,updateGrades,updateLevelAssociations, updatePeriod, updateStudent,updateStudentRequirements,updateSubjectAssociations,updateTermAssociations,updateUserAccounts,updateUserRoles

%SET_PROJECT% && %COPY_CONFIG% &&%DEPLOY_PROJECT%
goto end

:rules
SET DEPLOY_RULES=firebase deploy --only firestore:rules
%DEPLOY_RULES%

:indexes
SET DEPLOY_INDEX=firebase deploy --only firestore:indexes
%DEPLOY_INDEX%

goto end

:end
exit
