SET COPY_BUILD1=Xcopy /E /I .\src\emails\templates .\dist\emails\templates
%COPY_BUILD1%
SET COPY_BUILD2=Xcopy /E /I .\src\results\reports .\dist\results\reports
%COPY_BUILD2%