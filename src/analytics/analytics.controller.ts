import { Controller, Get, Query } from "@nestjs/common";
import { quotes } from "./qoutes";
import {
  AppRoutes,
  AppUtils,
  BestStudent,
  EnrollmentPerYear,
  FirestoreQuery,
  Result,
  ScorePerLevel,
  ScorePerSubject,
  Subject,
  Term
} from "../lib";
import { PeriodsService } from "../periods/periods.service";
import { EnrollmentsService } from "../enrollements/enrollments.service";
import { LevelsService } from "../levels/levels.service";
import { SubjectsService } from "../subjects/subjects.service";
import { FireBase } from "../firebase";

@Controller("analytics")
export class AnalyticsController {
  private resultsDb = FireBase.getCollection(AppRoutes.results.api.INDEX);

  constructor(private readonly periodsService: PeriodsService,
              private readonly enrollmentsService: EnrollmentsService,
              private readonly levelsService: LevelsService,
              private readonly subjectsService: SubjectsService) {
  }

  getResultsByOptions(options: any = {}) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<Result[]>((resolve, reject) => {
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
        return resolve(results);
      }).catch((reason) => reject(reason));
    });
  }

  @Get("getQuotes")
  getQuotes(@Query() options: any) {
    return new Promise<any>((resolve, reject) => {
      try {
        const allQuotes: string[] = quotes.trim().split("\n");
        const index = parseInt((Math.random() * allQuotes.length).toString(), 0);
        return resolve({ quote: allQuotes[index] });
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Get("loadReport")
  loadReport(@Query() options: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        // in future store computed reports and retrieve them from the database
        // monitor db reads and writes and update the stored report
        if (!AppUtils.stringIsSet(options.year)) {
          return reject("Select Year");
        }
        if (!AppUtils.stringIsSet(options.term_id)) {
          return reject("Select term");
        }
        if (!AppUtils.stringIsSet(options.period_id)) {
          return reject("Select term");
        }
        const currentPeriod = await this.periodsService.getPeriodById(options.period_id);
        if (!currentPeriod) {
          return reject("Selected Year and Term were not found, Try again");
        }
        const all_enrollments: EnrollmentPerYear[] = (await this.enrollmentsService.getEnrollmentsByOptions({}, false))
          .map((en) => {
            return {
              period_id: en.period_id,
              year: en.period.getYear(),
              level_id: en.level.id,
              levelAlias: en.level.alias,
              no_of_students: en.no_of_students
            };
          });
        const yearly_enrollment: EnrollmentPerYear[] = [];
        const yearsSet = new Set<number>();
        all_enrollments.map((en) => en.year).forEach((yr) => yearsSet.add(yr));
        for (const year of Array.from(yearsSet.values())) {
          const no_of_students_map = all_enrollments
            .filter((en1) => en1.year === year)
            .map((en) => en.no_of_students);
          const no_of_students = AppUtils.reduceToNum(no_of_students_map);
          yearly_enrollment.push({
            period_id: options.period_id,
            year,
            level_id: "",
            levelAlias: "",
            no_of_students
          });
        }
        const allLevels = (await this.levelsService.getLevelsByOptions({}));
        const levels = allLevels.sort((a, b) => AppUtils.sortComp(a.alias, b.alias));
        const current_enrollment: EnrollmentPerYear[] = levels.map((level) => {
          const enrollment = (all_enrollments).find((en) => {
            return en.period_id === options.period_id && en.level_id === level.id;
          });
          if (enrollment) {
            return enrollment;
          }
          return {
            period_id: options.period_id,
            year: currentPeriod.getYear(),
            level_id: level.id,
            levelAlias: level.alias,
            no_of_students: 0
          };
        });
        const results = await this.getResultsByOptions({ year: options.year });
        const resultSubjects = results.map((result) => result.getSubjects());
        const subjects = AppUtils.reduceToObjects<Subject>(resultSubjects);
        const allSubjects = (await this.subjectsService.getSubjectsByOptions({}))
          .sort((a, b) => AppUtils.sortComp(a.alias, b.alias));
        const average_score_per_subject: ScorePerSubject[] = [];
        for (const subject of allSubjects) {
          const subjectsList = subjects.filter((sub) => sub.alias === subject.alias);
          const subjectTotal = AppUtils.mapReduceToNum(subjectsList, "score");
          const subjectAverage = AppUtils.divide(subjectTotal, subjectsList.length, true, 0);
          average_score_per_subject.push({
            subjectAlias: subject.alias,
            subjectAverage
          });
        }
        const best_students: BestStudent[] = [];
        const average_score_per_level: ScorePerLevel[] = [];
        for (const level of levels) {
          const resultPerLevel = results.filter((result) => result.level_id === level.id);
          const totalList = resultPerLevel.map((result) => result.getTotal());
          const levelSubjects = resultPerLevel.map((result) => result.getSubjects());
          const reducedSubjects = AppUtils.reduceToObjects<Subject>(levelSubjects);
          const totalPerLevel = AppUtils.reduceToNum(totalList);
          const levelAverage = AppUtils.divide(totalPerLevel, reducedSubjects.length, true, 0);
          average_score_per_level.push({
            levelAlias: level.alias,
            levelAverage
          });
          options.level_id = level.id;
          options.sanitize = false;
          const loadedResults: any = (await this.getResultsByOptions(options));
          if (loadedResults) {
            const resultsPerLevel: Term[] = loadedResults.terms || [];
            const firstTerm = resultsPerLevel.find((term) => AppUtils.toNum(term.position) === 1);
            if (firstTerm) {
              const firstStudent = new Term().toObject(firstTerm);
              const rowTotal = firstStudent.getGradeTotals();
              best_students.push({
                levelAlias: level.alias,
                studentNo: firstStudent.studentNo,
                studentName: firstStudent.studentName,
                total: rowTotal.total,
                subjectAverage: rowTotal.subjectAverage,
                position: rowTotal.position
              });
            }
          }
        }
        const report = {
          current_enrollment,
          yearly_enrollment,
          average_score_per_subject,
          average_score_per_level,
          best_students
        };
        return resolve(report);
      } catch (e) {
        return reject(e);
      }
    });
  }
}
