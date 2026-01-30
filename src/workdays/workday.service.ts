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

/** Node passed to pdfmake table layout callbacks */
// interface PdfMakeTableLayoutNode {
//   table: { body: unknown[]; widths?: unknown[] };
// }

@Injectable()
export class WorkdayService {
  /**
   * Format a date to DD/MM/YYYY format
   */
  private formatDate(date: string | Date | number, language: Language): string {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();

    switch (language) {
      case Language.ENGLISH:
        return `${month}/${day}/${year}`;
      case Language.FRENCH:
        return `${day}/${month}/${year}`;
      default:
        throw new Error("Unrecognized language: " + String(language));
    }
  }

  /**
   * Format a date to HH:mm:ss format
   */
  private formatTime(date: string | Date | number): string {
    const d = new Date(date);
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const seconds = String(d.getSeconds()).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }

  private calculateSeconds(date: string): number {
    const dateParts = date.split(":").map((part) => parseInt(part, 10));
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
    let documentTitle: string;
    switch (data.language) {
      case Language.ENGLISH:
        documentTitle = "Monthly workday report";
        break;
      case Language.FRENCH:
        documentTitle = "Relevé des journées mensuel";
        break;
      case Language.UNRECOGNIZED:
        throw new Error("Unrecognized language: " + data.language);
    }

    const months: Record<Language, string[]> = {
      [Language.ENGLISH]: [
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
      [Language.FRENCH]: [
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
      [Language.UNRECOGNIZED]: [],
    };

    let periodText: string;
    switch (data.language) {
      case Language.ENGLISH:
        periodText =
          "Period: " +
          months[Language.ENGLISH][data.month - 1] +
          " " +
          data.year;
        break;
      case Language.FRENCH:
        periodText =
          "Période : " +
          months[Language.FRENCH][data.month - 1] +
          " " +
          data.year;
        break;
      default:
        throw new Error("Unrecognized language: " + String(data.language));
    }

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
                  text: "#",
                  alignment: "center",
                  margin: [0, 9],
                },
                {
                  text: "Date",
                  alignment: "center",
                  margin: [0, 9],
                },
                {
                  text: "Heure de début",
                  alignment: "center",
                  margin: [0, 2],
                },
                {
                  text: "Heure de fin",
                  alignment: "center",
                  margin: [0, 9],
                },
                {
                  text: "Coupure",
                  alignment: "center",
                  margin: [0, 9],
                },
                {
                  text: "Découchage",
                  alignment: "center",
                  margin: [0, 9],
                },
                {
                  text: "Temps travaillé",
                  alignment: "center",
                  margin: [0, 2],
                },
              ],
              ...(data.workdays.length === 0
                ? [
                    [
                      {
                        text: "Aucune journée n'a été enregistrée pour la période sélectionnée.",
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
                        text: workday.overnight ? "Oui" : "",
                        alignment: "center",
                        margin: [0, 2],
                        border:
                          index == data.workdays.length - 1
                            ? [false, false, false, true]
                            : [false, false, false, false],
                      },
                      {
                        text: workTimeSeconds
                          ? workTimeSeconds > 0
                            ? this.generateTimeFromSeconds(workTimeSeconds)
                            : ""
                          : "non calculé",
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
                  text: "Total",
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
        now.getTimezoneOffset();

        let footerDateText: string;
        switch (data.language) {
          case Language.ENGLISH:
            footerDateText =
              "Generated on " +
              this.formatDate(now, data.language) +
              " at " +
              this.formatTime(now);
            break;
          case Language.FRENCH:
            footerDateText =
              "Généré le " +
              this.formatDate(now, data.language) +
              " à " +
              this.formatTime(now);
            break;
          default:
            throw new Error("Unrecognized language: " + String(data.language));
        }

        let pageText: string;
        switch (data.language) {
          case Language.ENGLISH:
            pageText = "Page " + currentPage + " of " + pageCount;
            break;
          case Language.FRENCH:
            pageText = "Page " + currentPage + " sur " + pageCount;
            break;
          default:
            throw new Error("Unrecognized language: " + String(data.language));
        }

        return {
          columns: [
            {
              text: footerDateText,
              alignment: "left",
              margin: [20, 0, 0, 0],
            }, // Left informations
            {
              text: pageText,
              alignment: "center",
            },
            {
              text: process.env.WEBSITE_URL,
              alignment: "right",
              margin: [0, 0, 20, 0],
            }, // Right informations
          ],
        };
      },
    };

    try {
      console.log("Creating PDF...");
      const pdf = pdfMakeInstance.createPdf(docDefinition);
      console.log("PDF created.");

      // getBuffer() returns a Promise<Buffer> (pdfmake API)
      const buffer = await pdf.getBuffer();
      console.log("PDF buffer obtained, size:", buffer.length);

      return buffer;
    } catch (error) {
      console.error("Error creating PDF:", error);
      throw error;
    }
  }
}
