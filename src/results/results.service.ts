import { Injectable } from "@nestjs/common";
import {
  AppRoutes,
  AppUtils,
  DivCode,
  Enrollment,
  Exam,
  Fee,
  FirestoreQuery,
  Grading,
  Level,
  LevelsSubject,
  Period,
  PositionBase,
  Receipt,
  Requirement,
  Result,
  RippleUtils,
  Setting,
  Student,
  StudentStatus,
  Subject,
  Teacher,
  TeacherRole,
  Term
} from "../lib";
import { FireBase } from "../firebase";
import { ResultDeletedEvent, ResultEvents, ResultSavedEvent } from "../events/results";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { TeachersService } from "../teachers/teachers.service";
import { LevelsStreamsService } from "../levels-streams/levels-streams.service";
import { StudentsService } from "../students/students.service";
import { ExamsService } from "../exams/exams.service";
import { TermsService } from "../terms/terms.service";
import { SubjectsService } from "../subjects/subjects.service";
import { SettingsService } from "../settings/settings.service";
import { CacheService } from "../cache/cache.service";
import * as handleBars from "handlebars";
import { Email, TemplateDoc } from "../emails/types";
import path from "path";
import fs from "fs";
import { PeriodsService } from "../periods/periods.service";
import { EnrollmentsService } from "../enrollements/enrollments.service";
import { RequirementsService } from "../requirements/requirements.service";
import { FeesService } from "../fees/fees.service";
import { ReceiptsService } from "../receipts/receipts.service";
import { environment } from "../lib/environments/environment";
import { ReportTemplatesService } from "../reports/report-templates.service";
import { efrisInProduction, ReportsApi } from "../lib/environments/firebase";
// import * as numToWords from "num2words";
const numToWords = require("num2word");

const TEMPLATE_COLLECTION = "report-templates";
const MAIL_COLLECTION_SING = "email";
const MAIL_COLLECTION = `${MAIL_COLLECTION_SING}s`;

@Injectable()
export class ResultsService {
  private resultsDb = FireBase.getCollection(AppRoutes.results.api.INDEX);
  private results: Result[] = [];

  constructor(private readonly eventEmitter: EventEmitter2,
              private readonly teachersService: TeachersService,
              private readonly levelsStreamService: LevelsStreamsService,
              private readonly studentsService: StudentsService,
              private readonly examsService: ExamsService,
              private readonly termsService: TermsService,
              private readonly subjectsService: SubjectsService,
              private readonly settingsService: SettingsService,
              private readonly cache: CacheService,
              private readonly periodsService: PeriodsService,
              private readonly enrollmentsService: EnrollmentsService,
              private readonly requirementsService: RequirementsService,
              private readonly feesService: FeesService,
              private readonly receiptsService: ReceiptsService,
              private readonly reportTemplatesService: ReportTemplatesService) {
  }

  /*contactApi = (reportData: any[], description: string) => {
    return new Promise<any>((resolve, reject) => {
      try {
        if (reportData.length == 0) {
          return reject("Report can't be empty");
        }
        const firstReport = reportData[0];
        const reportName = firstReport.reportName;
        const nameIsNotSet = !AppUtils.stringIsSet(reportName);
        if (nameIsNotSet) {
          return reject("Set Report name under school settings and try again");
        }
        const path = require("path");
        const report = path.join(__dirname + `/reports/templates/${reportName}.jasper`);
        const options = {
          path: path.join(__dirname + "/reports/"),
          // path: path.join(__dirname + "/reports/jasperreports-6.1.0/"),
          reports: {
            demo: {
              // jasper: path.join(__dirname + "/reports/templates/report_p7@demo.jasper")
            }
          }
        };
        options.reports[reportName] = {
          jasper: report
        };
        const jasper = require("node-jasper-report")(options);
        // { reportParams, dataSource, reportName, description }
        console.log("getting jasper reports ready");
        jasper.ready(async () => {
          console.log("jasper reports is now ready");
          const pdfArr = [];
          // const fs = require("fs");
          for (const data of reportData) {
            // fill report
            const reportParams = {
              ...data.reportParams,
              headTeacherSign: "", // path to sign
              teacherSign: "", // path to sign
              photo: "", // path to photo
              logo: "" // path to logo
            };
            reportParams.logo = ""; // path to logo
            reportParams.photo = ""; // path to logo
            reportParams.teacherSign = ""; // path to logo
            reportParams.headTeacherSign = ""; // path to logo
            const reportConfig = {
              report: reportName,
              data: { ...reportParams },
              dataset: Array.from(data.dataSource)
            };
            const pdf = jasper.pdf(reportConfig);
            console.log("writing pdf to file");
            // uncomment fs above
            /!* fs.writeFile(path.join(__dirname + `/reports/${description}.pdf`), pdf, () => {
               console.log("writing pdf to file done");
             });*!/
            console.log("pdf file out put");
            pdfArr.push(pdf);
          }
          if (pdfArr.length > 1) {
            const { merge } = require("merge-pdf-buffers");
            const merged = await merge(pdfArr);
            return resolve(Buffer.from(merged));
            // return resolve({ description, buffer: Buffer.from(merged) });
          }
          return resolve(Buffer.from(pdfArr[0]));
          // return resolve({ description, buffer: Buffer.from(pdfArr[0]) });
        });
      } catch (e) {
        return reject(e?.toString());
      }
    });
  };*/
  contactApi = (data: any[], description: string) => {
    return new Promise<any>((resolve, reject) => {
      try {
        const sanitizeObject = AppUtils.sanitizeObject({ reportData: data });
        const body = JSON.stringify(sanitizeObject);
        const axios = require("axios");
        const api = ReportsApi(efrisInProduction);
        console.log(`contacting api at ${api}`);
        // `${environment.reports_api}/reports`
        return axios.post(`${api}`, body, {
          headers: {
            "Content-Type": "application/json"
            /*'Accept': 'application/json,application/pdf,application/octet-stream'*/
          },
          responseType: "stream"
        }).then(function(response: any) {
          try {
            const fileName = response.headers["content-disposition"].split("filename=")[1];
            console.log(`processing response from api at ${environment.reports_api}`);
            const pdf = response?.data;
            /*if (!pdf) {
              return reject("Report Server is offline or can not be reached");
            }*/
            // console.log("typeof pdf: " + (typeof pdf));
            const type = response.headers["content-type"] || "";
            const isPdf = type.toLowerCase().includes("pdf");
            const isFile = type.toLowerCase().includes("octet-stream");
            const isObject = typeof pdf === "object";
            if (isPdf || isFile || isObject) {
              return resolve({ description: fileName, buffer: pdf });
            }
            const json = JSON.parse(response.body);
            const errorText = Object.getOwnPropertyDescriptor(json, "detail")?.value || response.statusText;
            if (AppUtils.stringIsSet(errorText)) {
              return reject(errorText);
            }
            return reject("an unknown error occurred on the report server");
          } catch (e) {
            console.error("error generating report");
            console.error(e);
            return reject(e);
          }
        }).catch(function(err: any) {
          return reject(err);
        });
      } catch (e) {
        return reject(e?.toString());
      }
    });
  };
  generateReports = (terms: Term[],
                     level: Level,
                     currentPeriod: Period,
                     allSubjects: Subject[],
                     options: any) => {
    return new Promise<any>(async (resolve, reject) => {
      try {
        // const templateName = options.templateName || 'st-claver';
        const settings = await this.settingsService.getSettings();
        const description = (terms.length > 1) ? `Results for ${level.alias} ${currentPeriod.getDescription()}` : `Results for ${terms[0]?.studentName || ""}`;
        const cacheKey = description.trim().replace(/\s/g, "");
        const cache = await this.cache.getCacheById(cacheKey);
        if (Array.isArray(cache)) {
          if (cache.length > 0) {
            return this.contactApi(cache, description)
              .then((apiResponse: any) => resolve(apiResponse))
              .catch((reason) => reject(reason));
          }
        }
        const reportData: Promise<any>[] = [];
        const nextPeriods = (await this.periodsService.getPeriodsByOptions({
          dateOperator: ">",
          date: currentPeriod.getEndDate()
        }));
        const nextPeriod = nextPeriods[0] || new Period();
        const enrollment = (await this.enrollmentsService.getEnrollmentsByOptions({
          level_id: level.id,
          period_id: currentPeriod.id
        }))[0];
        if (!enrollment) {
          return reject(`Enrollment for ${level.alias} could not be determined, save at least one student in this class and try again or update current period`);
        }
        const headTeacher = (await this.teachersService.getTeachersByOptions({ role: TeacherRole.HEADTEACHER }))[0];
        if (!headTeacher) {
          return reject(`Headteacher not found, save at least one of the teachers as a headteacher and try again`);
        }
        let teacher;
        if (AppUtils.stringIsSet(level.teacher_id)) {
          teacher = await this.teachersService.getTeacherById(level.teacher_id);
          if (!teacher) {
            teacher = (await this.teachersService.getTeachersByOptions({ level_alias: level.alias }))[0];
          }
        } else {
          teacher = (await this.teachersService.getTeachersByOptions({ level_alias: level.alias }))[0];
        }
        if (!teacher) {
          return reject(`Class teacher for ${level.alias} could not be determined, assign one of the teachers to this class and try again`);
        }
        const fees = new Map<string, Fee>();
        for (const term of terms) {
          const student = (await this.studentsService.getStudentsByOptions({ studentNo: term.studentNo }))[0];
          if (!student) {
            reject(`student ${term.studentNo} was not found or was removed`);
            break;
          }
          const requirement = AppUtils.stringIsSet(student.requirement_id) ? (await this.requirementsService.getRequirementById(student.requirement_id) || new Requirement()) : new Requirement();
          const receiptOptions = {
            student_id: student.id, balance: 0, balanceOperator: ">"
          };
          const receipt = (await this.receiptsService.getReceiptsByOptions(receiptOptions))[0] || new Receipt();
          const fee = AppUtils.stringIsSet(student.fee_id) ? (await this.feesService.getFeeById(student.fee_id)) || new Fee() : new Fee();
          fees.set(student.fee_id, fee);
          reportData.push(this.fillReport(
            description,
            term,
            settings,
            level,
            teacher,
            headTeacher,
            currentPeriod,
            nextPeriod,
            enrollment,
            fee,
            receipt,
            requirement,
            allSubjects,
            student));
        }
        return Promise.all(reportData).then((data) => {
          try {
            if (1) {
              return this.cache.saveCache(cacheKey, data).then(() => {
                return this.contactApi(data, description)
                  .then((apiResponse: any) => resolve(apiResponse))
                  .catch((reason) => reject(reason));
              });
            }
            const templateName = settings.reportCard;
            return this.getHtmlFromTemplate(templateName).then((templateDoc) => {
              const compiledReports = data.map((reportInfo: any) => this.compileHtmlFromTemplate(reportInfo, templateDoc, description));
              return Promise.all(compiledReports).then((result) => {
                return resolve(result);
              }).catch((reason) => reject(reason));
            }).catch((reason) => reject(reason));
          } catch (e) {
            return reject(e?.toString());
          }
        }).catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  };
  compileHtmlFromTemplate = (data: any, temp: TemplateDoc, description: string) => {
    return new Promise<TemplateDoc>((resolve, reject) => {
      try {
        const template = handleBars.compile(temp.html, { data: true });
        const html = template(data);
        return resolve({ subject: description, html });
      } catch (e) {
        return reject(e);
      }
    });
  };
  createTemplate = (templateName: any) => {
    return new Promise<boolean>((resolve, reject) => {
      return this.templateExists(templateName).then((exists) => {
        if (exists) {
          return resolve(true);
        }
        FireBase.log(`creating  template ${templateName}`);
        return this.readTemplateFromFile(templateName).then((html) => {
          return this.saveTemplateDoc(templateName, { subject: templateName, html }).then(() => {
            FireBase.log(`creating  template ${templateName} succeeded`);
            return resolve(true);
          }).catch((error) => reject(error));
        }).catch((error) => reject(error));
      }).catch((error) => reject(error));
    });
  };
  templateExists = (templateName: any) => new Promise<boolean>((resolve, reject) => {
    return FireBase.getCollection(TEMPLATE_COLLECTION).doc(templateName)
      .get().then((docData) => {
        if (!docData.exists) {
          return resolve(false);
        }
        const template: any = docData.data();
        const subjectIsNoSet = template.subject && template.subject === "";
        if (subjectIsNoSet) {
          return resolve(false);
        }
        const htmlIsNotSet = template.html && template.html === "";
        if (htmlIsNotSet) {
          return resolve(false);
        }
        return resolve(true);
      }).catch((reason) => reject(reason));
  });
  saveTemplateDoc = (name: any, template: { subject: string, html: string }) => FireBase.getCollection(TEMPLATE_COLLECTION).doc(name).set(template);
  getHtmlFromTemplate = (templateName: string) => {
    return new Promise<TemplateDoc>((resolve, reject) => {
      return this.readTemplateFromDb(templateName).then((doc) => {
        if (!doc) {
          return this.createTemplate(templateName).then((created) => {
            if (created) {
              return this.readTemplateFromDb(templateName)
                .then((templateDoc) => {
                  if (!templateDoc) {
                    return reject(`reading template ${templateName} failed`);
                  }
                  return resolve(templateDoc);
                }).catch((reason: any) => reject(reason));
            }
            return reject(`creating template ${templateName} failed`);
          }).catch((reason) => reject(reason));
        }
        return resolve(doc);
      }).catch((reason) => reject(reason));
    });
  };
  readTemplateFromDb = (templateName: string) => {
    return new Promise<TemplateDoc | null>((resolve, reject) => {
      return FireBase.getCollection(TEMPLATE_COLLECTION).doc(templateName).get()
        .then((doc) => {
          if (!doc.exists) {
            return resolve(null);
          }
          const email: TemplateDoc | any = doc.data();
          return resolve(email);
        }).catch((reason) => reject(reason));
    });
  };
  readTemplateFromFile = (name: any, folderPath = "templates") => {
    return new Promise<string>((resolve, reject) => {
      const filePath = path.join(__dirname, `/reports/${folderPath}/${name}.html`);
      fs.readFile(filePath, "utf8", (error: any, htmlString: string) => {
        if (!error && htmlString) {
          return resolve(htmlString);
        } else {
          return reject(error);
        }
      });
    });
  };
  saveMail = (toSend: Email) => {
    const collection = FireBase.getCollection(MAIL_COLLECTION);
    const finder = collection
      .where("to", "==", toSend.to)
      .where("template.name", "==", toSend.template?.name)
      .where("reference", "==", toSend.reference)
      .limit(1)
      .get();
    // check existing
    return finder.then((docs) => {
      if (docs.empty) {
        return collection.add(toSend).then(() => "email has been queued for processing");
      }
      const doc = docs.docs[0];
      const mail: Email | any = doc.data();
      let message = "email already queued";
      if (mail.info) {
        message = mail.info.accepted.length > 0 ? "email was delivered" : "email was not delivered";
      } else {
        return collection.doc(doc.id).set(toSend).then(() => message);
      }
      return message;
    }).catch((error) => {
      FireBase.log(error);
      return "email could not be queued";
    });
  };

  fillReport(description: string,
             term: Term,
             settings: Setting,
             level: Level,
             teacher: Teacher,
             headTeacher: Teacher,
             thisPeriod: Period,
             nextPeriod: Period,
             enrollment: Enrollment,
             fee: Fee,
             receipt: Receipt,
             requirement: Requirement,
             allSubjects: Subject[],
             student: Student) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const gradeTotals = term.getGradeTotals();
        if (gradeTotals === null) {
          return reject("grade totals can not be determined, try again later");
        }
        const grades = term.getGrades();
        if (grades === null) {
          return reject("grades can not be determined, try again later");
        }
        const exams = term.exams;
        if (exams === null) {
          return reject("exams can not be determined, try again later");
        }
        const subjects = exams[0].subjects;
        if (subjects === null) {
          return reject("subjects can not be determined, try again later");
        }
        const daysAttended = term.daysAttended;
        const totalDays = term.totalDays;
        let logo = settings.photo;
        let teachersSign = teacher.photo;
        let headTeachersSign = headTeacher.photo;
        let photo = student.photo;
        try {
          const setPhoto = (img: any, title = "photo") => {
            const imgStr = img.toString();
            if (AppUtils.stringIsSet(imgStr)) {
              if (!AppUtils.isBase64(imgStr)) {
                throw new Error(`use base64 encoding for ${title}`);
              }
              return RippleUtils.getBase64(imgStr);
            }
            return "";
          };
          logo = setPhoto(logo, "school logo");
          photo = setPhoto(photo, "student photo");
          teachersSign = setPhoto(teachersSign, "class teacher's sign");
          headTeachersSign = setPhoto(headTeachersSign, "head teacher's sign");
        } catch (e) {
          return reject(e);
        }
        const thisEnd = AppUtils.getSlashedDate(thisPeriod.getEndDate(level.alias));
        const nextStart = level.showNextTermBeginsOn ? AppUtils.getSlashedDate(nextPeriod.getStartDate(level.alias)) : "";
        const nextEnd = AppUtils.getSlashedDate(nextPeriod.getEndDate(level.alias));
        const totalStudents = enrollment.no_of_students;
        // add default grading for these HEAD-TEACHER-COMMENTS ,CLASS-TEACHER-COMMENTS, CONDUCT-COMMENTS
        const studentName = student.getName();
        const studentNo = student.studentNo;
        const sex = student.sex;
        const studentAge = level.showDateOfBirth ? student.getAge() : null;
        const requirements = requirement.description;
        const nextFees = level.showNextTermSchoolFees ? fee.value.toLocaleString() : "";
        const feesBalance = level.showSchoolFeesBalance ? receipt.balance : null;
        const year = thisPeriod.getYear();
        const headTeacherComment = level.showHeadTeacherComment ? term.headTeachersComments : "";
        const classTeacherComment = level.showClassTeacherComment ? term.classTeachersComments : "";
        const conduct = level.showConductComment ? term.conductComments : "";
        const reportParams: Map<string, any> = new Map<string, any>();
        // logo
        // photo
        // teacherSign
        // headTeacherSign
        reportParams.set("logo", logo);
        reportParams.set("schoolName", settings.school_name);
        reportParams.set("schoolSubName", settings.school_sub_name);
        reportParams.set("schoolAddress", settings.address);
        reportParams.set("schoolPhoneNo", settings.phone_no);
        reportParams.set("schoolEmail", settings.email);
        reportParams.set("schoolMotto", settings.motto);
        reportParams.set("reportTitle", settings.reportTitle);
        reportParams.set("totalDays", totalDays);
        reportParams.set("totalStudents", totalStudents);
        // const levelName = numToWords(AppUtils.toNum(level.alias.split("")[1]));
        const levelName = numToWords(AppUtils.matchNum(level.alias, true));
        // console.log("levelName1: " + levelName + ", levelName2: " + levelName2);
        reportParams.set("levelName", levelName.toString());
        reportParams.set("level", level.alias);
        reportParams.set("term", thisPeriod.getTermName());
        reportParams.set("teacherSign", teachersSign);
        reportParams.set("headTeacherSign", headTeachersSign);
        reportParams.set("thisEnd", thisEnd);
        reportParams.set("nextStart", nextStart);
        reportParams.set("nextEnd", nextEnd);
        reportParams.set("photo", photo);
        reportParams.set("name", studentName);
        reportParams.set("age", studentAge);
        reportParams.set("daysAttended", daysAttended);
        reportParams.set("studentNo", studentNo);
        reportParams.set("year", year);
        reportParams.set("sex", sex);
        reportParams.set("requirements", requirements);
        reportParams.set("nextFees", nextFees);
        reportParams.set("feesBalance", feesBalance);
        reportParams.set("classTeacherComment", classTeacherComment);
        reportParams.set("headTeacherComment", headTeacherComment);
        reportParams.set("conduct", conduct);
        reportParams.set("gradeTotals", gradeTotals);
        const aliases = new Set(Array.from(exams.map((ex) => ex.alias)));
        const examPositions = gradeTotals["examPositions"] != null ? gradeTotals["examPositions"] : new Map();
        const examAggregates = gradeTotals["examAggregates"] != null ? gradeTotals["examAggregates"] : new Map();
        const examDivisions = gradeTotals["examDivisions"] != null ? gradeTotals["examDivisions"] : new Map();
        let totalTotal = 0;
        for (const alias of aliases) {
          // positions totals
          const aliasP_TOTAL = examPositions[alias] != null ? examPositions[alias] : "";
          reportParams.set(`${alias}P_TOTAL`, aliasP_TOTAL);
          // aggregate totals
          const aliasA_TOTAL = examAggregates[alias] != null ? examAggregates[alias] : "";
          reportParams.set(`${alias}A_TOTAL`, aliasA_TOTAL);
          // divisions totals
          const aliasD_TOTAL = examDivisions[alias] != null ? examDivisions[alias] : "";
          reportParams.set(`${alias}D_TOTAL`, aliasD_TOTAL);
          // number in class totals
          // TODO
          // no-of-students(totalStudents) here should be the students who sat the exam
          // meaning this number can differ from the no of active students
          // as shown by the enrollment, I have used the figure from enrollment
          // for now but we need to find a way to compute this figure based on the exam alias
          // this requires traversing all the student results and counting students individually
          reportParams.set(`${alias}N_TOTAL`, totalStudents);
          totalTotal = AppUtils.add(totalTotal, (gradeTotals[alias] || 0));
        }
        const examCount = aliases.size;
        // number in class totals
        /*reportParams.set("BOTN_TOTAL", "85"); //p6 85 //p5 "98"
        reportParams.set("EOTN_TOTAL", "83"); // 83 // "100"
        reportParams.set("MIDN_TOTAL", "84"); // 84 // "100"
        reportParams.set("OCTN_TOTAL", "84"); // 84 // "100"*/
        // reportParams.set("TOTAL_TOTAL", AppUtils.times(gradeTotals["total"], examCount)); // 83
        reportParams.set("TOTAL_TOTAL", totalTotal); // 83
        // positions totals
        /*const EOTP_TOTAL = examPositions["EOT"] != null ? examPositions["EOT"] : "";
        reportParams.set("EOTP_TOTAL", EOTP_TOTAL);
        const BOTP_TOTAL = examPositions["BOT"] != null ? examPositions["BOT"] : "";
        reportParams.set("BOTP_TOTAL", BOTP_TOTAL);
        const MIDP_TOTAL = examPositions["MID"] != null ? examPositions["MID"] : "";
        reportParams.set("MIDP_TOTAL", MIDP_TOTAL);
        const OCTP_TOTAL = examPositions["OCT"] != null ? examPositions["OCT"] : "";
        reportParams.set("OCTP_TOTAL", OCTP_TOTAL);*/

        // aggregate totals
        /* const EOTA_TOTAL = examAggregates["EOT"] != null ? examAggregates["EOT"] : "";
         reportParams.set("EOTA_TOTAL", EOTA_TOTAL);
         const BOTA_TOTAL = examAggregates["BOT"] != null ? examAggregates["BOT"] : "";
         reportParams.set("BOTA_TOTAL", BOTA_TOTAL);
         const MIDA_TOTAL = examAggregates["MID"] != null ? examAggregates["MID"] : "";
         reportParams.set("MIDA_TOTAL", MIDA_TOTAL);
         const OCTA_TOTAL = examAggregates["OCT"] != null ? examAggregates["OCT"] : "";
         reportParams.set("OCTA_TOTAL", OCTA_TOTAL);*/

        // divisions totals
        /*const EOTD_TOTAL = examDivisions["EOT"] != null ? examDivisions["EOT"] : "";
        reportParams.set("EOTD_TOTAL", EOTD_TOTAL);
        const BOTD_TOTAL = examDivisions["BOT"] != null ? examDivisions["BOT"] : "";
        reportParams.set("BOTD_TOTAL", BOTD_TOTAL);
        const MIDD_TOTAL = examDivisions["MID"] != null ? examDivisions["MID"] : "";
        reportParams.set("MIDD_TOTAL", MIDD_TOTAL);
        const OCTD_TOTAL = examDivisions["OCT"] != null ? examDivisions["OCT"] : "";
        reportParams.set("OCTD_TOTAL", OCTD_TOTAL);*/


        const dataSource: any[] = grades;
        const otherSubjects = allSubjects.filter((subject) => {
          return subjects.find((sub) => sub.id === subject.id) === undefined;
        });
        dataSource.push(dataSource[0]); // show english
        otherSubjects.forEach((subject) => {
          const row = {
            name: subject.alias,
            subjectName: subject.name,
            total: 0,
            subjectAverage: 0,
            aggregates: "",
            remarks: "",
            initials: "",
            position: 0,
            examPositions: {},
            examAggregates: {},
            examDivisions: {}
          };
          if (level.showAllSubjects) {
            dataSource.push(row);
          } else if (level.showEmptyRows) {
            row.name = "";
            row.subjectName = "";
            dataSource.push(row);
          }
        });
        let reportId: string;
        if (AppUtils.stringIsSet(level.report_id)) {
          // use level report card
          reportId = level.report_id;
        } else {
          // use general report card
          reportId = settings.reportCard;
        }
        const template = await this.reportTemplatesService.getReportById(reportId);
        if (!template) {
          return reject(`configure a default report template or specify template for ${level.alias}`);
        }
        const reportName = template.description;
        return resolve({ reportParams, dataSource, reportName, description });
      } catch (e) {
        return reject(e);
      }
    });
  }

  setGradeTotals(term: Term,
                 grading: Grading = new Grading(),
                 allExams: Exam[] = term.exams,
                 levelSubjects: LevelsSubject[],
                 level_id: any) {
    // TODO consider percentage_out_of_total on exams and use it to calculate percentages
    this.setGrades(term, grading, allExams, levelSubjects, level_id);
    const grades = term.getGrades();
    const columnTotals: any = {
      name: "TOTAL",
      total: 0,
      totalExpected: 0,
      subjectAverage: 0,
      aggregates: "",
      // exam 1 total, exam 2 total, exam 3 total etc. will appear here
      position: 0, // position for all the exams, based on total,average, or aggregates
      division: 0, // division for all the exams, based on total,average, or aggregates
      examAverages: {},
      examAggregates: {}, // -->check for isAggregated when computing this
      examPositions: {}, // position for each exam, based on exam total, exam average, or exam aggregates
      examDivisions: {} // based on exam aggregates -->check for isGraded on level subjects
    };
    const noOfExams = allExams.length;
    const gradedSubjects = allExams[0]?.subjects.filter((sub) => sub.graded) || [];
    // if subject is not graded then it sure will not be aggregated
    const aggregatedSubjects = gradedSubjects.filter((sub) => sub.aggregated) || [];
    const subjectsToAggregate = grades.filter((sub: any) => {
      // we are using alias === sub.name for comparison
      // use any other identifying field obtained in const grades = term.getGrades above
      const index = aggregatedSubjects.findIndex((gSub) => gSub.alias === sub.name);
      return index > -1;
    });
    for (const exam of allExams) {
      const thisExam = term.exams.find((ex) => ex.alias === exam.alias);
      if (!thisExam) {
        continue;
      }
      // -->check for isAggregated when computing this
      // isAggregated/isGraded determines exam.subjects.length
      const subjectsToGrade = grades.filter((grd: any) => {
        if (AppUtils.toNum(grd[exam.alias]) <= 0) {
          return false;
        }
        const index = gradedSubjects.findIndex((gSub) => gSub.alias === grd.name);
        return index > -1;
      });
      thisExam.total = AppUtils.mapReduceToNum(subjectsToGrade, exam.alias);
      columnTotals[exam.alias] = thisExam.total;
      columnTotals.examAverages[exam.alias] = AppUtils.divide(thisExam.total, subjectsToGrade.length);
      // get totals for each subject for this exam
      const examAggregateTotal = AppUtils.reduceToNum(subjectsToAggregate.map((sub: any) => {
        return AppUtils.matchNum(sub.examAggregates[exam.alias]);
      }));
      const div = grading.getDivision(examAggregateTotal);
      const missingMarksList = term.missingMarks.get(exam.alias) || [];
      const hasMissingMark = missingMarksList.length > 0;
      const ninesList = term.nines.get(exam.alias) || [];
      let divCode: DivCode | undefined = div?.code;
      if (div) {
        const hasNines = (div.min_no_nines === -1) ? false : (ninesList.length > div.min_no_nines);
        // console.log('hasMissingMark1: ' + hasMissingMark + ', hasNines1: ' + hasNines + ' ' + term.studentName);
        if (hasMissingMark) {
          divCode = div.missing_mark;
        } else if (hasNines) {
          divCode = div.on_nines;
        }
      }
      columnTotals.examDivisions[exam.alias] = divCode || DivCode.X;
      /*columnTotals.examAggregates now stores a number instead of a grade code
      * since this is column total for multiple subjects, while codes are per subject*/
      columnTotals.examAggregates[exam.alias] = examAggregateTotal; // termly aggregates
    }
    const termlyTotal = AppUtils.mapReduceToNum(grades, "total"); // Exam1 total + Exam2 total + Exam3 total
    const termlyAverage = AppUtils.divide(termlyTotal, gradedSubjects.length);
    columnTotals.total = termlyAverage;
    const aliases = new Set(Array.from(allExams.map((ex) => ex.alias)));
    const examCount = aliases.size;
    columnTotals.totalExpected = AppUtils.times(AppUtils.times(gradedSubjects.length, 100), examCount);
    columnTotals.subjectAverage = AppUtils.divide(termlyAverage, noOfExams);
    const aggregatesMap = subjectsToAggregate
      .filter((grade: any) => AppUtils.stringIsSet(grade.aggregates)) // remove invalids
      .map((grade2: any) => grade2.aggregates);
    columnTotals.aggregates = grading.getTotalAggregates(aggregatesMap); // total aggregates
    const division = grading.getDivision(columnTotals.aggregates);
    let divisionCode: DivCode | undefined = division?.code;
    if (division) {
      const hasMissingMark = Array.from(term.missingMarks.values()).length > 0;
      const hasNines = (division.min_no_nines === -1) ? false : Array.from(term.nines.values()).length > (division.min_no_nines);
      // TODO console.log('hasMissingMark: ' + hasMissingMark + ', hasNines: ' + hasNines + ' ' + term.studentName);
      if (hasMissingMark) {
        divisionCode = division.missing_mark;
      } else if (hasNines) {
        divisionCode = division.on_nines;
      }
    }
    columnTotals.division = divisionCode || DivCode.X;
    term.aggregates = columnTotals.aggregates;
    term.division = columnTotals.division;
    term.setGradeTotals(columnTotals);
  }

  /*set term exam and subject id's for use later when searching for results*/
  setTermsExamsAndSubjects(result: Result) {
    result.term_ids = result.mask.map((term) => term.id);
    const exams = result.mask.map((term) => term.exams);
    const allExams = AppUtils.reduceToObjects<Exam>(exams);
    result.exam_ids = allExams.map((exam) => exam.id);
    const subjectSet = new Set<string>();
    result.getSubjects().forEach((subject) => subjectSet.add(subject.id));
    result.subject_ids = Array.from(subjectSet.values());
  }

  setGrades(term: Term,
            grading: Grading = new Grading(),
            allExams: Exam[] = term.exams,
            levelSubjects: LevelsSubject[],
            level_id: any) {
    const examMap = new Map<string, Subject[]>();
    const sortedExams = allExams.sort((a, b) => AppUtils.sortComp(a.value.toLocaleString(), b.value.toLocaleString()));
    for (let index = 0; index < sortedExams.length; index++) {
      const exam = sortedExams[index];
      const thisExam = term.exams.find((ex) => ex.alias === exam.alias);
      if (!thisExam) {
        continue;
      }
      examMap.set(thisExam.alias, thisExam.subjects);
    }
    const examAliases = sortedExams.map((exam) => exam.alias);
    const subjects: string[] = (allExams[0]?.subjects || []).map((subject) => subject.alias);
    const grades = [];
    for (const subjectAlias of Array.from(subjects)) {
      const levelsSubject = levelSubjects.find((lvs) => {
        return lvs.hasSubjectAlias(subjectAlias) && lvs.level_id === level_id;
      });
      if (!levelsSubject) {
        throw new Error(`configuration for ${subjectAlias} for ${term.studentName} can not  be found`);
      }
      const subjectRow: any = {
        name: subjectAlias,
        subjectName: levelsSubject.subject.name,
        total: 0,
        subjectAverage: 0,
        aggregates: "",
        remarks: "",
        initials: "",
        position: 0, // subject position(row position) for all exams, based(field above) on total score, or total average, or aggregates
        examPositions: {}, // position for each exam(column position), based on exam subject score, or exam subject aggregate
        examAggregates: {}, // aggregate for score in each exam
        examDivisions: {}
      };
      let subjectTotalScore = 0;
      for (let index = 0; index < examAliases.length; index++) {
        const examAlias = examAliases[index];
        // TODO remove
        let subject = term.getSubject(examAlias, subjectAlias);
        if (!subject) {
          subject = levelsSubject.getSubject();
        }
        const score = AppUtils.toNum(subject?.score || 0);
        subjectRow[examAlias] = score;
        const isValidScore = score > 0 && score <= 100;
        if (isValidScore) {
          subjectTotalScore += score;
        }
        if (score === -1) {
          const isCompulsory = levelsSubject?.compulsory || false;
          if (isCompulsory) {
            const listOfMissingMarks = term.missingMarks.get(examAlias) || [];
            listOfMissingMarks.push(subject?.alias || "");
            term.missingMarks.set(examAlias, listOfMissingMarks);
          }
        }
        const subjectGrade = grading.getGrade(score);
        const codeString = subjectGrade?.code || "";
        const codeNum = AppUtils.matchNum(codeString);
        if (codeNum === 9) {
          const affects_min_no_nines = levelsSubject?.affects_min_no_nines || false;
          if (affects_min_no_nines) {
            const listOfNines = term.nines.get(examAlias) || [];
            listOfNines.push(subject?.alias || "");
            term.nines.set(examAlias, listOfNines);
          }
        }
        // used to display aggregates on some reports each st-claver's report
        subjectRow.examAggregates[examAlias] = codeString;
      }
      subjectRow.total = subjectTotalScore;
      const noOfExams = examAliases.length;
      subjectRow.subjectAverage = AppUtils.divide(subjectTotalScore, noOfExams);
      const grade = grading.getGrade(subjectRow.subjectAverage);
      subjectRow.aggregates = grade?.code || "";
      subjectRow.remarks = grade?.getRemark() || "";
      grades.push(subjectRow);
    }
    term.setGrades(grades);
  }

  setPositions(terms: Term[],
               allExams: Exam[],
               grading: Grading,
               position_base: PositionBase,
               totalDays: number,
               periodExpired: boolean,
               levelSubjects: LevelsSubject[],
               level_id: any) {
    if (terms.length === 0) {
      return [];
    }
    if (allExams.length === 0) {
      return [];
    }
    const subjectGradesMap: Map<string, any[]> = new Map<string, any[]>();
    const totalsMap: Map<string, any> = new Map<string, any>();
    for (const term of terms) {
      term.totalDays = totalDays;
      term.periodExpired = periodExpired;
      this.setGradeTotals(term, grading, allExams, levelSubjects, level_id); // sets grades too
      const subjectGrades = term.getGrades();
      const totals = term.getGradeTotals();
      const studentNo = term.studentNo; // term name used for to store student name
      subjectGradesMap.set(studentNo, subjectGrades);
      totalsMap.set(studentNo, totals);
    }
    const subjects = allExams[0]?.subjects || [];
    if (subjects.length === 0) {
      return [];
    }
    // termly positions per subject --> using grades
    const setSubjectPositionsPerTerm = () => {
      for (const subject of subjects) {
        const scoreMap: Map<number, string[]> = new Map<number, string[]>();
        for (const term of terms) {
          const studentNo = term.studentNo; // term name used for to store student name
          const subjectGrades = subjectGradesMap.get(studentNo) || [];
          // termly positions per subject --using grades
          let score = 0;
          const subjectGrade = subjectGrades.find((grade) => grade.name === subject.alias);
          if (subjectGrade) {
            switch (position_base) {
              case PositionBase.AVERAGE:
                score = subjectGrade.subjectAverage;
                break;
              case PositionBase.AGGREGATES:
              case PositionBase.TOTAL:
              default:
                score = subjectGrade.total;
                break;
            }
          }
          const studentList = scoreMap.get(score) || [];
          studentList.push(studentNo);
          scoreMap.set(score, studentList);
          // foreach exam push in scoreMap per exam
        }
        // sort scoreMap and assign positions according to index
        const scores = AppUtils.sortNum(Array.from(scoreMap.keys()));
        scores.forEach((score, index) => {
          const subjectTermlyPosition = AppUtils.add(index, 1); // position for all exams
          const studentNos = scoreMap.get(score) || [];
          studentNos.forEach((studentNo) => {
            const subjectGrades = subjectGradesMap.get(studentNo) || [];
            const subjectGrade = subjectGrades.find((grade) => grade.name === subject.alias);
            if (subjectGrade) {
              subjectGrade.position = subjectTermlyPosition;
            }
          });
        });
      }
    };
    setSubjectPositionsPerTerm();
    // exam positions per subject --> using grades
    const setSubjectPositionsPerExam = () => {
      for (const subject of subjects) {
        for (const exam of allExams) {
          const scoreMap: Map<number, string[]> = new Map<number, string[]>();
          for (const term of terms) {
            const studentNo = term.studentNo; // term name used for to store student name
            const subjectGrades = subjectGradesMap.get(studentNo) || [];
            // termly positions per subject --using grades
            let score = 0;
            const subjectGrade = subjectGrades.find((grade) => grade.name === subject.alias);
            if (subjectGrade) {
              // we are not using position_base this time since only average is compared
              score = subjectGrade[exam.alias];
            }
            const studentList = scoreMap.get(score) || [];
            studentList.push(studentNo);
            scoreMap.set(score, studentList);
          }
          // sort scoreMap and assign positions according to index
          const scores = AppUtils.sortNum(Array.from(scoreMap.keys()));
          scores.forEach((score, index) => {
            const subjectExamPosition = AppUtils.add(index, 1); // position per exam per subject
            const studentNos = scoreMap.get(score) || [];
            studentNos.forEach((studentNo) => {
              const subjectGrades = subjectGradesMap.get(studentNo) || [];
              const subjectGrade = subjectGrades.find((grade) => grade.name === subject.alias);
              if (subjectGrade) {
                subjectGrade.examPositions[exam.alias] = subjectExamPosition;
              }
            });
          });
        }
      }
    };
    setSubjectPositionsPerExam();
    // exam positions --using exam column totals
    const setExamPositionsPerTerm = () => {
      for (const exam of allExams) {
        const scoreMap: Map<number, string[]> = new Map<number, string[]>();
        for (const term of terms) {
          const studentNo = term.studentNo; // term name used for to store student name
          const totals: any = totalsMap.get(studentNo) || {};
          let score = 0;
          switch (position_base) {
            case PositionBase.AVERAGE:
              score = totals.examAverages[exam.alias] || 0;
              break;
            case PositionBase.AGGREGATES:
              score = totals.examAggregates[exam.alias] || 0;
              break;
            case PositionBase.TOTAL:
            default:
              score = totals[exam.alias] || 0;
              break;
          }
          const studentList = scoreMap.get(score) || [];
          studentList.push(studentNo);
          scoreMap.set(score, studentList);
        }
        // sort scoreMap and assign positions according to index
        const scores = AppUtils.sortNum(Array.from(scoreMap.keys()));
        scores.forEach((score, index) => {
          const examPosition = AppUtils.add(index, 1); // position per exam
          const studentNos = scoreMap.get(score) || [];
          studentNos.forEach((studentNo) => {
            const totals: any = totalsMap.get(studentNo);
            if (totals) {
              totals.examPositions[exam.alias] = examPosition;
            }
          });
        });
      }
    };
    setExamPositionsPerTerm();
    // termly positions --using grand totals
    const setPositionsPerTerm = () => {
      const scoreMap: Map<number, string[]> = new Map<number, string[]>();
      for (const term of terms) {
        const studentNo = term.studentNo; // term name used for to store student name
        const totals: any = totalsMap.get(studentNo) || {};
        let score = 0;
        switch (position_base) {
          case PositionBase.AVERAGE:
            score = totals.subjectAverage || 0;
            break;
          case PositionBase.AGGREGATES:
            score = totals.aggregates || 0;
            break;
          case PositionBase.TOTAL:
          default:
            score = totals.total || 0;
            break;
        }
        const studentList = scoreMap.get(score) || [];
        studentList.push(studentNo);
        scoreMap.set(score, studentList);
      }
      // sort scoreMap and assign positions according to index
      const scores = AppUtils.sortNum(Array.from(scoreMap.keys()));
      scores.forEach((score, index) => {
        const termPosition = AppUtils.add(index, 1); // position per term
        const studentNos = scoreMap.get(score) || [];
        studentNos.forEach((studentNo) => {
          const totals: any = totalsMap.get(studentNo);
          if (totals) {
            totals.position = termPosition;
          }
          const term = terms.find((trm) => trm.studentNo === studentNo);
          if (term) {
            term.position = termPosition.toLocaleString();
          }
        });
      });
    };
    setPositionsPerTerm();
    return terms;
  }

  assignInitials(levelAlias: string,
                 levelSubjects: LevelsSubject[],
                 grade: any,
                 initialsMap = new Map<string, string[]>()) {
    return new Promise<any>(async (resolve, reject) => {
      const levelSubject = levelSubjects.find((lvs) => lvs.hasSubjectAlias(grade.name));
      if (!levelSubject) {
        return reject(`subject ${levelAlias} ${grade.name} was not found contact admin`);
      }
      const initials = initialsMap.get(levelSubject.id) || [];
      if (initials.length === 0) {
        // TODO remove hanging
        const subjectTeachers = await this.teachersService.getTeachersByOptions({ levels_subject_id: levelSubject.id }, true);
        if (subjectTeachers.length === 0) {
          return reject(`subject teachers for ${levelAlias} ${grade.name} were not found contact admin`);
        }
        const noInitials = subjectTeachers
          .filter((tr) => !AppUtils.stringIsSet(tr.initials))
          .map((noInitial) => noInitial.getName());
        if (noInitials.length > 0) {
          return reject(`set initials for  ${noInitials.join(",")}`);
        }
        const initialStrings = subjectTeachers.map((tr) => tr.initials);
        initials.push(...initialStrings);
      }
      const index = RippleUtils.getRandomNum(0, initials.length - 1);
      if (initials[index]) {
        grade.initials = initials[index];
      }
      return resolve(grade);
    });
  }

  createResults(options: any = {}) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        // in future store computed results and retrieve them from the database
        // monitor db reads and writes and update the stored results
        const sanitize = options.sanitize || true;
        const resultsToCreate = await this.getResultsByOptions(options);
        const levels_stream_id = options.levels_stream_id;
        if (!AppUtils.stringIsSet(levels_stream_id)) {
          return reject("Select Level and Stream and try again");
        }
        if (!AppUtils.stringIsSet(options.year)) {
          return reject("Select Year");
        }
        if (!AppUtils.stringIsSet(options.term_id)) {
          return reject("Select term");
        }
        if (!AppUtils.stringIsSet(options.exam_id)) {
          return reject("Select exam");
        }
        if (!AppUtils.stringIsSet(options.subject_id)) {
          return reject("Select subject");
        }
        const levelsStream = await this.levelsStreamService.getLevelsStreamById(levels_stream_id);
        const students = await this.studentsService.getStudentsByOptions({ levels_stream_id });
        if (!levelsStream) {
          return reject(`Selected Level and Stream does not exist or was removed`);
        }
        if (students.length === 0) {
          return reject(`Selected Level ${levelsStream?.level.alias} and Stream ${levelsStream?.stream.name} has no students`);
        }
        const originalExam = await this.examsService.getExamById(options.exam_id);
        if (!originalExam) {
          return reject(`Selected Exam does not exist or was removed`);
        }
        const originalTerm = await this.termsService.getTermById(options.term_id);
        if (!originalTerm) {
          return reject(`Selected Term does not exist or was removed`);
        }
        const originalSubject = await this.subjectsService.getSubjectById(options.subject_id);
        if (!originalSubject) {
          return reject(`Selected Subject does not exist or was removed`);
        }
        const response: any[] = [];
        for (const student of students) {
          if (student.status !== StudentStatus.ACTIVE) {
            continue;
          }
          const datum = {
            // append options so that client can know where to send these results
            studentName: student.getName(),
            studentNo: student.studentNo,
            score: 0, ...options
          };
          let result = new Result();
          result.year = options.year;
          result.level_id = levelsStream.level_id;
          result.student_id = student.id;
          result.mask = []; // terms
          const existingResult = resultsToCreate.find((res) => res.exists(result.year, result.level_id, result.student_id));
          if (existingResult) {
            result = existingResult;
          }
          result.levelAlias = levelsStream.level.alias;
          result.studentName = student.getName();
          result.studentNo = student.studentNo;
          const existingTerm = result.mask.find((term) => term.id === options.term_id);
          // make copies so that they don't contain previous student's data
          const newSubject = new Subject().toObject(originalSubject);
          const newTerm = new Term().toObject(originalTerm);
          const newExam = new Exam().toObject(originalExam);
          if (!existingTerm) {
            newExam.subjects.push(newSubject);
            newTerm.exams.push(newExam);
            newTerm.studentName = result.studentName;
            newTerm.studentNo = result.studentNo;
            newTerm.result_id = result.id;
            result.mask.push(newTerm);
          } else {
            existingTerm.studentName = result.studentName;
            existingTerm.studentNo = result.studentNo;
            existingTerm.result_id = result.id;
            const exam = existingTerm.exams.find((ex) => ex.id === options.exam_id);
            if (!exam) {
              newExam.subjects.push(newSubject);
              existingTerm.exams.push(newExam);
            } else {
              // check for subject
              // TODO to remove
              const subject = exam.subjects.find((sub) => sub.id === options.subject_id);
              if (!subject) {
                exam.subjects.push(newSubject);
              } else {
                datum.score = subject.score;
              }
            }
          }
          if (!existingResult) {
            resultsToCreate.push(result);
          }
          response.push(datum);
        }
        /*returning from here means results will not be used, just added
        * these steps to clarify the process*/
        return sanitize ? resolve(AppUtils.sanitizeObject(response)) : resolve(response);
      } catch (e) {
        return reject(e);
      }
    });
  }

  save(result: Result) {
    return new Promise<Result>(async (resolve, reject) => {
      try {
        this.setTermsExamsAndSubjects(result);
        await result.validate();
        if (AppUtils.stringIsSet(result.id)) {
          result.setModified();
          return this.resultsDb.doc(result.id.toString())
            .set(AppUtils.sanitizeObject(result))
            .then(() => {
              const savedBr = (new Result()).toObject(result);
              const index = this.results.findIndex((prd) => prd.id === savedBr.id);
              if (index > -1) {
                this.results[index] = savedBr;
              } else {
                this.results.push(savedBr);
              }
              this.eventEmitter.emit(ResultEvents.SAVE, new ResultSavedEvent(result));
              return resolve((new Result()).toObject(result));
            })
            .catch((error) => reject(error));
        }
        return this.resultsDb.add(AppUtils.sanitizeObject(result))
          .then((result) => {
            const newResult = (new Result()).toObject(result);
            newResult.id = result.id;
            this.results.push(newResult);
            this.eventEmitter.emit(ResultEvents.SAVE, new ResultSavedEvent(newResult));
            return resolve(newResult);
          }).catch((error) => reject(error));
      } catch (e) {
        return reject(e);
      }
    });
  }

  getResultById(id: string) {
    return new Promise<Result | null>((resolve, reject) => {
      if (typeof id === "object") {
        return reject(`unsupported result record identifier, contact admin`);
      }
      if (!AppUtils.stringIsSet(id)) {
        return reject("provide result identifier");
      }
      return this.resultsDb.doc(id.toString()).get().then((snapshot) => {
        const rawData = snapshot.data();
        if (snapshot.exists && rawData) {
          const result = (new Result()).toObject(rawData);
          result.id = snapshot.id;
          return resolve(result);
        }
        return resolve(null);
      }).catch((error) => reject(error));
    });
  }

  deleteManyResults = (resultIds: any[]) => {
    return new Promise<boolean>((resolve, reject) => {
      if (resultIds.length === 0) {
        return reject("select results and try again");
      }
      let batch = this.resultsDb.firestore.batch();
      resultIds.forEach((id) => {
        try {
          if (AppUtils.stringIsSet(id)) {
            batch = batch.delete(this.resultsDb.doc(id.toString()));
          }
        } catch (e) {
          console.error(e);
        }
      });
      return batch.commit().then((result) => {
        resultIds.forEach((id) => {
          if (AppUtils.stringIsSet(id)) {
            const index = this.results.findIndex((prd) => prd.id === id);
            if (index > -1) {
              this.results.splice(index, 1);
            }
            this.eventEmitter.emit(ResultEvents.DELETE, new ResultDeletedEvent(id));
          }
        });
        return resolve(result.length === resultIds.length);
      }).catch((error) => reject(error));
    });
  };

  saveResults(results: Result[]) {
    return new Promise<boolean>((resolve, reject) => {
      let batch = this.resultsDb.firestore.batch();
      for (const result of results) {
        result.setModified();
        if (!AppUtils.stringIsSet(result.id)) {
          batch = batch.create(this.resultsDb.doc(), AppUtils.sanitizeObject(result));
        } else {
          batch = batch.set(this.resultsDb.doc(result.id.toString()), AppUtils.sanitizeObject(result));
        }
      }
      return batch.commit()
        .then((saved) => {
          this.results.splice(0);
          return resolve(saved.length === results.length);
        })
        .catch((error) => reject(error));
    });
  }

  hasResults() {
    return this.results.length > 0;
  }

  extractExamsFromResults = (terms: Term[],
                             levelsSubjects: LevelsSubject[],
                             level_id: any) => {
    if (terms.length === 0) {
      return [];
    }
    const examSet = new Map<string, Exam>();
    const subjectSet = new Map<string, Subject>();
    const map = terms.map((term) => term.exams);
    const allExams = AppUtils.reduceToObjects<Exam>(map);
    allExams.forEach((exam) => {
      // make new instances so that original data doesn't get modified
      exam.subjects.forEach((subject) => subjectSet.set(subject.alias, new Subject().toObject(subject)));
      examSet.set(exam.alias, new Exam().toObject(exam));
    });
    const subjects = Array.from(subjectSet.values());
    // strip subject objects of identifying fields
    const allSubjects = subjects.map((subject) => {
      const levelsSubject = levelsSubjects.find((sub) => {
        return sub.subject_id === subject.id && sub.level_id === level_id;
      });
      if (levelsSubject) {
        /*displayField: string; // field on subject displayed on reports (alias,name)
        graded: boolean; // determines if it affects total
        aggregated: boolean; // determines if it affects aggregates and thus division
        compulsory: boolean; // when missing, division becomes X
        affects_min_no_nines: boolean; // affects division when it has an F9*/
        subject.displayField = levelsSubject.displayField;
        subject.graded = levelsSubject.graded;
        subject.aggregated = levelsSubject.aggregated;
        subject.compulsory = levelsSubject.compulsory;
        subject.affects_min_no_nines = levelsSubject.affects_min_no_nines;
      } else {
        // subject.score = 0;
        // subject.gradeCode = '';
        console.error(`Level_id ${level_id} Subject_id ${subject.id} was not found`);
      }
      return subject;
    });
    const exams = Array.from(examSet.values());
    // strip exam objects of identifying fields
    exams.forEach((exam) => {
      exam.subjects = allSubjects;
      exam.total = 0;
    });
    return exams;
  };

  getResultsByOptions(options: any = {}) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<Result[]>((resolve, reject) => {
      if (!AppUtils.hasResponse(options) && this.hasResults()) {
        console.log(`\n------------using existing ${this.results.length} results---------------\n`);
        // return resolve(this.results);
      }
      let queryFn = this.resultsDb.orderBy("created");
      const set = new Set<FirestoreQuery>();
      if (AppUtils.stringIsSet(options.student_id)) {
        set.add({ key: "student_id", operator: "==", value: options.student_id });
      }
      if (AppUtils.stringIsSet(options.studentName)) {
        set.add({ key: "studentName", operator: "==", value: options.studentName });
      }
      if (AppUtils.stringIsSet(options.studentNo)) {
        set.add({ key: "studentNo", operator: "==", value: options.studentNo });
      }
      if (AppUtils.stringIsSet(options.level_id)) {
        set.add({ key: "level_id", operator: "==", value: options.level_id });
      }
      if (AppUtils.stringIsSet(options.levelAlias)) {
        set.add({ key: "levelAlias", operator: "==", value: options.levelAlias });
      }
      const year = AppUtils.toNum(options.year);
      if (year > 0) {
        set.add({ key: "year", operator: "==", value: year.toString() });
      }
      // Only a single array-contains clause is allowed in a query
      if (options.subject_ids !== undefined) {
        queryFn = queryFn.where("subject_ids", "array-contains", options.subject_ids);
      }
      if (options.term_ids !== undefined) {
        queryFn = queryFn.where("term_ids", "array-contains", options.term_ids);
      }
      if (options.exam_ids !== undefined) {
        queryFn = queryFn.where("exam_ids", "array-contains", options.exam_ids);
      }
      if (AppUtils.stringIsSet(options.modifiedBy)) {
        set.add({ key: "modifiedBy", operator: "==", value: options.modifiedBy });
      }
      if (AppUtils.stringIsSet(options.date)) {
        const operator = options.dateOperator || "==";
        set.add({ key: "created", operator, value: AppUtils.getShortDate(options.date) });
      }
      queryFn = FireBase.getQueryReference(queryFn, set);
      if (options.startDate && options.endDate) {
        queryFn = FireBase.getEntitiesByDateRange(queryFn,
          options.startDate,
          options.endDate,
          true, "created");
      }
      return queryFn.get().then((snap) => {
        if (snap.empty) {
          return resolve([]);
        }
        const results: Result[] = snap.docs.map((doc) => {
          const result = new Result().toObject(doc.data());
          result.id = doc.id;
          return result;
        });
        if (!AppUtils.hasResponse(options)) {
          this.results = results;
          console.log(`\n------------loaded ${this.results.length} results successfully---------------\n`);
        }
        return resolve(results);
      }).catch((reason) => reject(reason));
    });
  }

  validateResult(result: Result) {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        await result.validate();
        const level = await this.levelsStreamService.getLevelById(result.level_id);
        if (!level) {
          return reject(`'Specified Level for ${result.studentName} does not exist or was removed'`);
        }
        const student = await this.studentsService.getStudentById(result.student_id);
        if (!student) {
          return reject(`'Specified student ${result.studentName} does not exist or was removed'`);
        }
        // check year against known periods
        const termIds = result.mask.map((term) => {
          return this.periodsService.getPeriodsByOptions({ term_id: term.id });
        });
        return Promise.all(termIds).then((results) => {
          const allPeriods = AppUtils.reduceToObjects<Period>(results);
          if (allPeriods.length === 0) {
            return reject(`Term ${result.mask[0]?.name} does not exist among periods`);
          }
          const allYears = AppUtils.reduceToObjects(allPeriods.map((arr) => arr.getYears()));
          const yearExists = allYears.findIndex((yr) => yr === AppUtils.toNum(result.year)) > -1;
          if (!yearExists) {
            return reject(`Result Year ${result.year} does not exist among periods`);
          }
          return resolve(true);
        }).catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }
}

