import { Injectable } from "@nestjs/common";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import {
  GenerateMonthlyWorkdayReportRequest,
  Language,
} from "src/proto/workdays";
import { plannify_logo } from "src/utils";

/** pdfmake instance with createPdf and getBuffer (build browser or server) */
interface PdfMakeInstance {
  addVirtualFileSystem?: (vfs: Record<string, unknown>) => void;
  vfs?: Record<string, unknown>;
  createPdf: (
    doc: unknown,
    opts?: unknown,
    tableLayouts?: unknown,
    fonts?: unknown,
  ) => { getBuffer: () => Promise<Buffer> };
}

type LanguageMessages = {
  documentTitle: string;
  periodLabel: (monthName: string, year: number) => string;
  months: string[];
  headers: {
    index: {
      name: string;
      margins: number[];
    };
    date: {
      name: string;
      margins: number[];
    };
    startTime: {
      name: string;
      margins: number[];
    };
    endTime: {
      name: string;
      margins: number[];
    };
    rest: {
      name: string;
      margins: number[];
    };
    overnight: {
      name: string;
      margins: number[];
    };
    workTime: {
      name: string;
      margins: number[];
    };
  };
  noWorkdays: string;
  overnightYes: string;
  workTimeNotComputed: string;
  totalLabel: string;
  footerGeneratedOn: (date: string, time: string) => string;
  footerPage: (current: number, total: number) => string;
  dateFormat: (day: string, month: string, year: number) => string;
};

const MESSAGES: Record<Language, LanguageMessages> = {
  [Language.ENGLISH]: {
    documentTitle: "Monthly workday report",
    periodLabel: (monthName, year) => `Period: ${monthName} ${year}`,
    months: [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ],
    headers: {
      index: {
        name: "#",
        margins: [0, 9],
      },
      date: {
        name: "Date",
        margins: [0, 9],
      },
      startTime: {
        name: "Start time",
        margins: [0, 9],
      },
      endTime: {
        name: "End time",
        margins: [0, 9],
      },
      rest: {
        name: "Break",
        margins: [0, 9],
      },
      overnight: {
        name: "Overnight",
        margins: [0, 9],
      },
      workTime: {
        name: "Worked time",
        margins: [0, 9],
      },
    },
    noWorkdays: "No workday was recorded for the selected period.",
    overnightYes: "Yes",
    workTimeNotComputed: "not computed",
    totalLabel: "Total",
    footerGeneratedOn: (date, time) =>
      `Generated on ${date} at ${time} (Paris time)`,
    footerPage: (current, total) => `Page ${current} of ${total}`,
    dateFormat: (day, month, year) => `${month}/${day}/${year}`,
  },
  [Language.FRENCH]: {
    documentTitle: "Relevé mensuel des journées",
    periodLabel: (monthName, year) => `Période : ${monthName} ${year}`,
    months: [
      "Janvier",
      "Février",
      "Mars",
      "Avril",
      "Mai",
      "Juin",
      "Juillet",
      "Août",
      "Septembre",
      "Octobre",
      "Novembre",
      "Décembre",
    ],
    headers: {
      index: {
        name: "#",
        margins: [0, 9],
      },
      date: {
        name: "Date",
        margins: [0, 9],
      },
      startTime: {
        name: "Heure de début",
        margins: [0, 2],
      },
      endTime: {
        name: "Heure de fin",
        margins: [0, 9],
      },
      rest: {
        name: "Coupure",
        margins: [0, 9],
      },
      overnight: {
        name: "Découchage",
        margins: [0, 9],
      },
      workTime: {
        name: "Temps travaillé",
        margins: [0, 2],
      },
    },
    noWorkdays:
      "Aucune journée n'a été enregistrée pour la période sélectionnée.",
    overnightYes: "Oui",
    workTimeNotComputed: "non calculé",
    totalLabel: "Total",
    footerGeneratedOn: (date, time) =>
      `Généré le ${date} à ${time} (heure de Paris)`,
    footerPage: (current, total) => `Page ${current} sur ${total}`,
    dateFormat: (day, month, year) => `${day}/${month}/${year}`,
  },
  [Language.UNRECOGNIZED]: {
    documentTitle: "",
    periodLabel: () => "",
    months: [],
    headers: {
      index: {
        name: "#",
        margins: [],
      },
      date: {
        name: "",
        margins: [],
      },
      startTime: {
        name: "",
        margins: [],
      },
      endTime: {
        name: "",
        margins: [],
      },
      rest: {
        name: "",
        margins: [],
      },
      overnight: {
        name: "",
        margins: [],
      },
      workTime: {
        name: "",
        margins: [],
      },
    },
    noWorkdays: "",
    overnightYes: "",
    workTimeNotComputed: "",
    totalLabel: "",
    footerGeneratedOn: () => "",
    footerPage: () => "",
    dateFormat: (day, month, year) => `${day}/${month}/${year}`,
  },
};

function getMessages(lang: Language): LanguageMessages {
  return MESSAGES[lang] ?? MESSAGES[Language.ENGLISH];
}

@Injectable()
export class WorkdayService {
  /**
   * Extract date components in a specific timezone
   */
  private getDateComponentsInTimezone(
    date: string | Date | number,
    timeZone: string,
  ): {
    day: string;
    month: string;
    year: string;
    hours: string;
    minutes: string;
    seconds: string;
  } {
    const d = new Date(date);
    const formatter = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone,
      hour12: false,
    });

    const parts = formatter.formatToParts(d);
    const partMap: Record<string, string> = {};
    parts.forEach((part) => {
      partMap[part.type] = part.value;
    });

    return {
      day: partMap.day,
      month: partMap.month,
      year: partMap.year,
      hours: partMap.hour,
      minutes: partMap.minute,
      seconds: partMap.second,
    };
  }

  /**
   * Format a date with language-specific format (using Paris timezone)
   */
  private formatDate(date: string | Date | number, language: Language): string {
    const components = this.getDateComponentsInTimezone(date, "Europe/Paris");
    const tr = getMessages(language);
    return tr.dateFormat(
      components.day,
      components.month,
      Number(components.year),
    );
  }

  /**
   * Format a date to HH:mm:ss format (using Paris timezone)
   */
  private formatTime(date: string | Date | number): string {
    const components = this.getDateComponentsInTimezone(date, "Europe/Paris");
    return `${components.hours}:${components.minutes}:${components.seconds}`;
  }

  private calculateSeconds(date: string): number {
    const dateParts = date.split(":").map((part) => Number.parseInt(part, 10));
    const dateObj = new Date();
    dateObj.setHours(dateParts[0], dateParts[1], dateParts[2] || 0, 0);
    return (
      dateObj.getHours() * 3600 +
      dateObj.getMinutes() * 60 +
      dateObj.getSeconds()
    );
  }

  private calculateWorkTimeInSeconds(
    start: string,
    end: string,
    rest: string,
  ): number {
    if (start < end) {
      // start 05h00 - end 18h00
      return (
        this.calculateSeconds(end) -
        this.calculateSeconds(start) -
        this.calculateSeconds(rest)
      );
    } else {
      // start 18h00 - end 05h00
      return (
        24 * 3600 -
        (this.calculateSeconds(start) - this.calculateSeconds(end)) -
        this.calculateSeconds(rest)
      );
    }
  }

  private generateTimeFromSeconds(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    const formattedHours = hours.toString().padStart(2, "0");
    const formattedMinutes = minutes.toString().padStart(2, "0");
    const formattedSeconds = remainingSeconds.toString().padStart(2, "0");

    return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
  }

  async generateMonthlyWorkdayPdf(
    data: GenerateMonthlyWorkdayReportRequest,
  ): Promise<Buffer> {
    const tr = getMessages(data.language);
    const monthName = tr.months[data.month - 1];
    const documentTitle = tr.documentTitle;
    const periodText = tr.periodLabel(monthName, data.year);

    const pdfMakeInstance = pdfMake as PdfMakeInstance;
    const fonts = pdfFonts as Record<string, unknown> & {
      pdfMake?: { vfs?: Record<string, unknown> };
    };

    // Configure virtual fonts for pdfmake (vfs_fonts exports the vfs object directly)
    if (typeof pdfMakeInstance.addVirtualFileSystem === "function") {
      pdfMakeInstance.addVirtualFileSystem(pdfFonts as Record<string, unknown>);
    } else if (fonts.pdfMake?.vfs) {
      pdfMakeInstance.vfs = fonts.pdfMake.vfs;
    } else {
      pdfMakeInstance.vfs = pdfFonts as Record<string, unknown>;
    }

    let totalWorkTimeSeconds: number = 0;

    const docDefinition = {
      pageOrientation: "portrait",
      pageMargins: [30, 20, 30, 20],
      info: {
        title: `plannify-${String(data.month).padStart(2, "0")}-${data.year}`,
        author: "Plannify",
        subject: "report",
        keywords: "report, workdays, monthly",
      },
      images: {
        logo: plannify_logo,
      },
      content: [
        {
          columns: [
            {
              image: "logo",
              alignment: "left",
              height: 20,
            },
            {
              stack: [
                {
                  text: documentTitle,
                  alignment: "right",
                  fontSize: 20,
                },
                {
                  text: data.driverFirstname + " " + data.driverLastname,
                  alignment: "right",
                  fontSize: 14,
                },
                {
                  text: periodText,
                  alignment: "right",
                  fontSize: 14,
                },
                " ",
              ],
            },
          ],
        },
        {
          text: "",
        },
        {
          table: {
            headerRows: 1,
            widths: [30, "*", "*", "*", "*", "*", "*"],
            body: [
              [
                {
                  text: tr.headers.index.name,
                  alignment: "center",
                  margin: tr.headers.index.margins,
                },
                {
                  text: tr.headers.date.name,
                  alignment: "center",
                  margin: tr.headers.date.margins,
                },
                {
                  text: tr.headers.startTime.name,
                  alignment: "center",
                  margin: tr.headers.startTime.margins,
                },
                {
                  text: tr.headers.endTime.name,
                  alignment: "center",
                  margin: tr.headers.endTime.margins,
                },
                {
                  text: tr.headers.rest.name,
                  alignment: "center",
                  margin: tr.headers.rest.margins,
                },
                {
                  text: tr.headers.overnight.name,
                  alignment: "center",
                  margin: tr.headers.overnight.margins,
                },
                {
                  text: tr.headers.workTime.name,
                  alignment: "center",
                  margin: tr.headers.workTime.margins,
                },
              ],
              ...(data.workdays.length === 0
                ? [
                    [
                      {
                        text: tr.noWorkdays,
                        colSpan: 7,
                        alignment: "center",
                        margin: [0, 4],
                      },
                    ],
                  ]
                : data.workdays.map((workday, index) => {
                    const workTimeSeconds: number | null = workday.endTime
                      ? this.calculateWorkTimeInSeconds(
                          workday.startTime,
                          workday.endTime,
                          workday.restTime,
                        )
                      : null;
                    totalWorkTimeSeconds +=
                      workTimeSeconds && workTimeSeconds > 0
                        ? workTimeSeconds
                        : 0;

                    let workTimeText: string;
                    if (workTimeSeconds == null) {
                      workTimeText = tr.workTimeNotComputed;
                    } else if (workTimeSeconds > 0) {
                      workTimeText =
                        this.generateTimeFromSeconds(workTimeSeconds);
                    } else {
                      workTimeText = "";
                    }

                    return [
                      {
                        text: index + 1,
                        alignment: "center",
                        margin: [0, 2],
                        border:
                          index == data.workdays.length - 1
                            ? [true, false, false, true]
                            : [true, false, false, false],
                      },
                      {
                        text: this.formatDate(workday.date, data.language),
                        alignment: "center",
                        margin: [0, 2],
                        border:
                          index == data.workdays.length - 1
                            ? [false, false, false, true]
                            : [false, false, false, false],
                      },
                      {
                        text: workday.startTime,
                        alignment: "center",
                        margin: [0, 2],
                        border:
                          index == data.workdays.length - 1
                            ? [false, false, false, true]
                            : [false, false, false, false],
                      },
                      {
                        text: workday.endTime ?? "/",
                        alignment: "center",
                        margin: [0, 2],
                        border:
                          index == data.workdays.length - 1
                            ? [false, false, false, true]
                            : [false, false, false, false],
                      },
                      {
                        text: workday.restTime,
                        alignment: "center",
                        margin: [0, 2],
                        border:
                          index == data.workdays.length - 1
                            ? [false, false, false, true]
                            : [false, false, false, false],
                      },
                      {
                        text: workday.overnight ? tr.overnightYes : "",
                        alignment: "center",
                        margin: [0, 2],
                        border:
                          index == data.workdays.length - 1
                            ? [false, false, false, true]
                            : [false, false, false, false],
                      },
                      {
                        text: workTimeText,
                        alignment: "center",
                        border:
                          index == data.workdays.length - 1
                            ? [false, false, true, true]
                            : [false, false, true, false],
                        margin: [0, 2],
                      },
                    ];
                  })),
              [
                {
                  text: " ",
                  colSpan: 7,
                  border: [false, false, false, false],
                },
              ],
              [
                {
                  text: tr.totalLabel,
                  alignment: "center",
                },
                {
                  text: " ",
                  border: [false, true, false, true],
                },
                {
                  text: " ",
                  border: [false, true, false, true],
                },
                {
                  text: " ",
                  border: [false, true, false, true],
                },
                {
                  text: " ",
                  border: [false, true, false, true],
                },
                {
                  text: " ",
                  border: [false, true, false, true],
                },
                {
                  text: this.generateTimeFromSeconds(totalWorkTimeSeconds),
                  alignment: "center",
                },
              ],
            ],
            dontBreakRows: true,
            keepWithHeaderRows: true,
          },
          layout: {
            fillColor: (rowIndex: number) => {
              if (rowIndex != 0 && rowIndex < data.workdays.length)
                return rowIndex % 2 === 1 ? null : "#e5ebf2"; // Gray for even rows, white (or transparent) for odd rows
              else return null;
            },
          },
        },
      ],
      footer: (currentPage: number, pageCount: number) => {
        const now: Date = new Date();

        const dateStr = this.formatDate(now, data.language);
        const timeStr = this.formatTime(now);
        const footerDateText = tr.footerGeneratedOn(dateStr, timeStr);
        const pageText = tr.footerPage(currentPage, pageCount);

        return {
          columns: [
            {
              text: footerDateText,
              alignment: "left",
              margin: [20, 0, 0, 0],
            }, // Left informations
            {
              text: pageText,
              alignment: "right",
              margin: [0, 0, 20, 0],
            }, // Right informations
          ],
        };
      },
    };

    const pdf = pdfMakeInstance.createPdf(docDefinition);

    // getBuffer() returns a Promise<Buffer> (pdfmake API)
    const buffer = await pdf.getBuffer();

    return buffer;
  }
}
