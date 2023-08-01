import { Body, Controller, Delete, Get, Post, Query, StreamableFile } from "@nestjs/common";
import { ResultsService } from "./results.service";
import { AppUtils, Comments, Exam, Result, Subject, Term } from "../lib";
import { Converter } from "../converter";
import { CacheService } from "../cache/cache.service";
import { LevelsService } from "../levels/levels.service";
import { PeriodsService } from "../periods/periods.service";
import { GradingsService } from "../gradings/gradings.service";
import { LevelsSubjectsService } from "../levels-subjects/levels-subjects.service";
import { SubjectsService } from "../subjects/subjects.service";
import { LevelsStreamsService } from "../levels-streams/levels-streams.service";
import { ExamsService } from "../exams/exams.service";
import { TermsService } from "../terms/terms.service";
import { StudentsService } from "../students/students.service";

@Controller("results")
export class ResultsController {
  constructor(private readonly service: ResultsService,
              private readonly cache: CacheService,
              private readonly levelsService: LevelsService,
              private readonly periodsService: PeriodsService,
              private readonly gradingsService: GradingsService,
              private readonly levelsSubjectsService: LevelsSubjectsService,
              private readonly subjectsService: SubjectsService,
              private readonly levelsStreamService: LevelsStreamsService,
              private readonly examsService: ExamsService,
              private readonly termsService: TermsService,
              private readonly studentsService: StudentsService) {
  }

  @Post("save")
  save(@Body() body: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const params = Converter.fromBody(body);
        const resultObject = params?.result;
        const comments = params.comments;
        if (!resultObject && !comments) {
          return reject("Please set result and try again !");
        }
        if (Array.isArray(comments)) {
          const resultsToSave: Result[] = [];
          for (const commentObj of comments) {
            /*id: term.id,
        result_id: term.result_id,
        conductComments: term.conductComments,
        classTeachersComments: term.classTeachersComments,
        headTeachersComments: term.headTeachersComments,
        daysAttended: term.daysAttended*/
            const result = await this.service.getResultById(commentObj.result_id);
            if (!result) {
              return reject(`Results for ${commentObj.studentName} were not found or were deleted`);
            }
            const term: any = result.getTerm(commentObj.id);
            if (term) {
              Object.keys(commentObj).forEach((key) => {
                term[key] = commentObj[key];
              });
              resultsToSave.push(result);
            }
          }
          if (resultsToSave.length === 0) {
            return reject(`Comments could not be saved !, contact admin`);
          }
          return this.service.saveResults(resultsToSave)
            .then(() => resolve(true))
            .catch((reason) => reject(reason));
        }
        if (Array.isArray(resultObject)) {
          const scores = Array.from(resultObject);
          if (scores.length === 0) {
            return reject("Enter At least one result and try again");
          }
          // check if scores >= 0
          const invalidScore = scores.find((score: any) => {
            return score.score < -1 || score.score > 100;
          });
          if (invalidScore) {
            return reject(`Score for ${invalidScore.studentName} must be between 0 & 100 or -1 for missing marks`);
          }
          const options = scores[0];
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
          if (!AppUtils.stringIsSet(options.period_id)) {
            return reject("Select Year and Term");
          }
          const currentPeriod = await this.periodsService.getPeriodById(options.period_id);
          if (!currentPeriod) {
            return reject(`Selected Year and Term does not exist or was removed`);
          }
          if (currentPeriod.isExpired()) {
            const expiryDate = AppUtils.getSlashedDate(currentPeriod.getEndDate());
            return reject(`Selected Year and Term expired on ${expiryDate}`);
          }
          if (currentPeriod.getYear().toString() !== options.year.toString()) {
            return reject(`Selected Year ${options.year} does not match period year ${currentPeriod.getYear()}`);
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
          if (currentPeriod.term_id.toString() !== options.term_id.toString()) {
            return reject(`Selected Term ${originalTerm.name} does not match period term ${currentPeriod.getTermName()}`);
          }
          const originalSubject = await this.subjectsService.getSubjectById(options.subject_id);
          if (!originalSubject) {
            return reject(`Selected Subject does not exist or was removed`);
          }
          /*options - {
  studentName: 'Njunaki Kamaranga ',
  studentNo: '2022/00001',
  score: 23,
  year: '2022',
  term_id: 'KDF1n6t4M8V7elkloAAm',
  level_id: 'X3o3XQ9nEOHMWY2CDlSv',
  exam_id: 'KQQaNFiDiJ6RBd2tHEJj',
  subject_id: 'MoOvfZwvODwOIe9kzVEg',
  allowDuplicates: 'true',
  stream_id: 'kHzmtAM1vXECiHK0bdxm',
  period_id: 'mjAK6e18ak3vb5cRdTj9',
  levels_stream_id: '3qZST3gFEYO1B867DVbi',
  create: 'true'
}*/
          const results = await this.service.getResultsByOptions({
            year: options.year,
            level_id: options.level_id
          });
          const resultsToSave: Result[] = [];
          for (const score of scores) {
            const student = students.find((st) => st.studentNo === score.studentNo);
            if (!student) {
              return reject(`Student ${score.studentName} does not exist or was removed`);
            }
            // make copies so that they don't contain previous student's data
            const newSubject = new Subject().toObject(originalSubject);
            const newTerm = new Term().toObject(originalTerm);
            const newExam = new Exam().toObject(originalExam);
            newSubject.score = score.score;
            let result = new Result();
            result.setModified();
            result.year = options.year;
            result.level_id = levelsStream.level_id;
            result.student_id = student.id;
            result.mask = []; // terms
            const existingResult = results.find((res) => res.exists(result.year, result.level_id, result.student_id));
            if (existingResult) {
              result = existingResult;
            }
            result.levelAlias = levelsStream.level.alias;
            result.studentName = student.getName();
            result.studentNo = student.studentNo;
            const existingTerm = result.mask.find((term) => term.id.toString() === options.term_id.toString());
            if (!existingTerm) {
              newExam.subjects.push(newSubject);
              newTerm.exams.push(newExam);
              result.mask.push(newTerm);
            } else {
              console.log("existingTerm");
              console.log(existingTerm);
              const examIndex = existingTerm.exams.findIndex((ex) => ex.id.toString() === options.exam_id.toString());
              const exam = existingTerm.exams[examIndex];
              if (!exam) {
                newExam.subjects.push(newSubject);
                console.log("new exam");
                console.log(exam);
                existingTerm.exams.push(newExam);
              } else {
                console.log("existing exam");
                console.log(exam);
                // check for subject
                // TODO remove
                const duplicateSubjects = exam.subjects.filter((sub) => sub.id.toString() === options.subject_id.toString());
                const subject = duplicateSubjects[0];
                if (!subject) {
                  console.log("new subject");
                  console.log(newSubject);
                  exam.subjects.push(newSubject);
                } else {
                  console.log("existing subject");
                  console.log(subject);
                  subject.score = score.score;
                }
                /*this next part seems to be dealing with duplication of marks
                * i am commenting it out for now to see how this works*/
                /*const nextIndex = existingTerm.exams.findIndex((ex) => ex.value.toString() === (exam.value + 1).toString());
                if (nextIndex > -1) {
                  const map = new Map<string, Subject>();
                  const nextExam = existingTerm.exams[nextIndex];
                  for (const sub of exam.subjects) {
                    // TODO set term_id on subjects
                    const duplicateIndex = nextExam.subjects.findIndex((nextSub) => {
                      if (nextSub.id.toString() !== sub.id.toString()) {
                        return false;
                      }
                      if (Number.isNaN(`${sub.score}`) || Number.isNaN(`${nextSub.score}`)) {
                        return false;
                      }
                      return sub.score.toString() === nextSub.score.toString();
                    });
                    if (duplicateIndex < 0) {
                      map.set(sub.id, sub);
                    } else {
                      console.log(`${score.studentName} has a duplicate mark in ${nextExam.alias}(${sub.alias}), allow duplicates and try again`);
                      if (options.allowDuplicates) {
                        map.set(sub.id, sub);
                      } else {
                        return reject(`${score.studentName} has a duplicate mark in ${nextExam.alias}(${sub.alias}), allow duplicates and try again`);
                      }
                    }
                  }
                  exam.subjects = Array.from(map.values());
                } else {
                  const map = new Map<string, Subject>();
                  exam.subjects.forEach((sub, index) => {
                    const subId = !subject ? newSubject.id : subject.id;
                    if (sub.id === subId) {
                      const newSub = !subject ? newSubject : subject;
                      map.set(sub.id, newSub);
                    } else {
                      map.set(sub.id, sub);
                    }
                  });
                  exam.subjects = Array.from(map.values());
                }*/
              }
            }
            console.log("final - Result: " + result.id);
            resultsToSave.push(result);
          }
          const validations = resultsToSave.map((result) => this.service.validateResult(result));
          return Promise.all(validations).then(() => {
            return this.service.saveResults(resultsToSave)
              .then((saved) => {
                if (saved) {
                  return resolve(saved);
                }
                return reject("unable to save all results, try again later");
              }).catch((reason) => reject(reason));
          }).catch((reason) => reject(reason));
        } else {
          const toSave = (new Result()).toObject(resultObject);
          return this.service.validateResult(toSave).then(() => {
            return this.service.save(toSave).then((saved) => {
              return resolve(saved);
            }).catch((reason) => reject(reason));
          }).catch((reason) => reject(reason));
        }
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Get("download")
  download(@Query() options: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const file: any = await this.createReport(options);
        const fileName = AppUtils.normalizeString(file.description); // .concat(".pdf");
        return resolve(new StreamableFile(file.buffer));
      } catch (e) {
        console.log("error downloading file: \n" + e);
        return reject(e);
      }
    });
  }

  @Get("findAll")
  findAll(@Query() options: any) {
    return new Promise<any>(async (resolve, reject) => {
      return this.createReport(options)
        .then((result) => resolve(result))
        .catch((reason) => reject(reason));
    });
  }

  createReport(options: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        // in future store computed results and retrieve them from the database
        // monitor db reads and writes and update the stored results
        const sanitize = options?.sanitize?.toString() === "true" || true;
        const create = options?.create?.toString() === "true" || false;
        if (create) {
          /*returning from here means results will not be used, just added
          * these steps to clarify the process*/
          return this.service.createResults(options)
            .then((response) => resolve(response))
            .catch((reason) => reject(reason));
        }
        const level = await this.levelsService.getLevelById(options.level_id);
        if (!level) {
          return reject("Selected Level was not found Try again");
        }
        const currentPeriod = await this.periodsService.getPeriodById(options.period_id);
        if (!currentPeriod) {
          return reject("Selected Year and Term were not found, Try again");
        }
        const grading = await this.gradingsService.getGradingById(level.grading_id);
        if (!grading) {
          return reject(`Please set up grading for ${level.alias}`);
        }
        const levelSubjects = await this.levelsSubjectsService.getLevelsSubjectsByOptions({ level_id: options.level_id });
        if (levelSubjects.length === 0) {
          return reject(`Please set up subjects for ${level.alias}`);
        }
        const allSubjects = await this.subjectsService.getSubjectsByOptions({});
        if (allSubjects.length === 0) {
          return reject(`Please set add subjects`);
        }
        options.levelAlias = level.alias; // for clearCache background function
        const cacheKey = Object.keys(options).map((key) => key.replace(/\s/g, "")).join("-");
        const cache: any = await this.cache.getCacheById(cacheKey);
        if (cache) {
          console.log("using cache here ");
          if (Array.isArray(cache.terms) && Array.isArray(cache.exams)) {
            if (cache.terms.length > 0 && cache.exams.length > 0) {
              const cachedTerms: Term[] = (cache.terms || []).map((value: any) => new Term().toObject(value));
              const cachedExams: Exam[] = (cache.exams || []).map((value: any) => new Exam().toObject(value));
              if (options.print) {
                const result_ids: any[] = options.result_ids?.split(",") || [];
                if (!Array.isArray(options.result_ids)) {
                  return reject("Please specify results identifiers and try again !");
                }
                if (result_ids.length === 0) {
                  return reject("Please select results to delete and try again !");
                }
                /*use all results to grade and assign positions then print just the selected ones*/
                const toPrint = cachedTerms.filter((cachedTerm) => result_ids.indexOf(cachedTerm.result_id) > -1);
                if (toPrint.length > 0) {
                  const file: any = await this.service.generateReports(toPrint, level, currentPeriod, allSubjects, options);
                  return resolve(file);
                }
                return reject("Printable Results were not found, try adding/modifying results");
              }
              return resolve({ terms: cachedTerms, exams: cachedExams });
            }
          }
        }
        const results = await this.service.getResultsByOptions(options);
        if (results.length === 0) {
          return reject(`Results not found`);
        }
        const masks = results.map((result) => result?.getTerms() || []);
        const allTerms: Term[] = AppUtils.reduceToObjects<Term>(masks);
        const totalDays = currentPeriod.getTotalDays() || 0;
        const periodExpired = currentPeriod.isExpired();
        const position_base = level.position_base;
        const allExams = this.service.extractExamsFromResults(allTerms, levelSubjects, level.id);
        const terms = this.service.setPositions(
          allTerms,
          allExams,
          grading,
          position_base,
          totalDays,
          periodExpired,
          levelSubjects,
          level.id);
        /*assign remarks and initials*/
        const initialsMap = new Map<string, string[]>();
        let htrRemarks = null;
        let classTrRemarks = null;
        let conductRemarks = null;
        if (level.showClassTeacherComment) {
          classTrRemarks = (await this.gradingsService.getGradingsByOptions({ description: Comments.CLASS_TEACHER }))[0];
          if (!classTrRemarks) {
            return reject(`Please contact admin to set up class  teacher remarks or to turn off class teacher comments`);
          }
        }
        if (level.showHeadTeacherComment) {
          htrRemarks = (await this.gradingsService.getGradingsByOptions({ description: Comments.HEADTEACHER }))[0];
          if (!htrRemarks) {
            return reject(`Please contact admin to set up head  teacher remarks or to turn off head teacher comments`);
          }
        }
        if (level.showConductComment) {
          conductRemarks = (await this.gradingsService.getGradingsByOptions({ description: Comments.CONDUCT }))[0];
          if (!conductRemarks) {
            return reject(`Please contact admin to set up conduct remarks or to turn off conduct comments`);
          }
        }
        for (const term of terms) {
          const grades = term.getGrades();
          const gradeTotal = term.getGradeTotals();
          const useAutoHtrRemarks = htrRemarks && !AppUtils.stringIsSet(term.headTeachersComments);
          if (useAutoHtrRemarks) {
            const htrCode = htrRemarks?.getGrade(gradeTotal.subjectAverage);
            term.headTeachersComments = htrCode?.getRemark() || "";
          }
          const useAutoClassTrRemark = classTrRemarks && !AppUtils.stringIsSet(term.classTeachersComments);
          if (useAutoClassTrRemark) {
            const clasCode = classTrRemarks?.getGrade(gradeTotal.subjectAverage);
            term.classTeachersComments = clasCode?.getRemark() || "";
          }
          const useAutoConductRemark = classTrRemarks && !AppUtils.stringIsSet(term.conductComments);
          if (useAutoConductRemark) {
            const clasCode = conductRemarks?.getGrade(gradeTotal.subjectAverage);
            term.conductComments = clasCode?.getRemark() || "";
          }
          for (const grade of grades) {
            // TODO remove hanging when skip==false on getTeachersByOptions
            console.log(`${grade.name} ${term.studentNo} ${term.studentName}`);
            await this.service.assignInitials(level.alias, levelSubjects, grade, initialsMap);
          }
        }
        const resultsToPrint: Term[] = [];
        if (options.print) {
          const result_ids: any[] = options.result_ids?.split(",") || [];
          if (result_ids.length === 0) {
            return reject("Please select results to delete and try again !");
          }
          /*use all results to grade and assign positions then print just the selected ones*/
          const toPrint = allTerms.filter((term) => result_ids.indexOf(term.result_id) > -1);
          resultsToPrint.push(...toPrint);
        }
        if (resultsToPrint.length > 0) {
          const file: any = await this.service.generateReports(resultsToPrint, level, currentPeriod, allSubjects, options);
          return resolve(file);
        }
        console.log("results6: " + (new Date()).toTimeString());
        const responseData = { terms, exams: allExams };
        return this.cache.saveCache(cacheKey, responseData).then(() => {
          console.log("results7: " + (new Date()).toTimeString());
          return resolve(responseData);
        }).catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Delete("delete")
  remove(@Query() params: any) {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        const result_ids = params?.result_ids?.toString().split(",");
        if (Array.isArray(result_ids)) {
          return this.service.deleteManyResults(result_ids)
            .then((ok) => resolve(ok))
            .catch((reason) => reject(reason));
        } else {
          return reject("select results and try again");
        }
      } catch (e) {
        return reject(e);
      }
    });
  }
}
