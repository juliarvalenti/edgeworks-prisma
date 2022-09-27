import { EdgeworksLog } from ".prisma/client";
import { PrismaClient } from "@prisma/client";
import puppeteer from "puppeteer";

const prisma = new PrismaClient();

const addNewClimberLog = async (edgeworksLog: Omit<EdgeworksLog, "id">) => {
  return prisma.edgeworksLog
    .create({ data: edgeworksLog })
    .then((res) => {
      console.log("Successfully added log: ", res);
    })
    .catch((err) => {
      console.warn("Error adding log: ", err);
    });
};

const scrapeFromSite = async (): Promise<number> => {
  const url =
    "https://portal.rockgympro.com/portal/public/d07dfd11bc91daa7e96cd5c65bc813d8/occupancy?&iframeid=occupancyCounter&fId=1095";
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  let result;

  try {
    const goto = await page.goto(url, {
      timeout: 180000,
    });
    const text = await goto?.text();
    if (!text) throw new Error("No text");

    const ary = text.split("\n");
    const seaLoc = ary.findIndex((str) => {
      return str.includes(",'SEA' : {");
    });

    if (seaLoc === -1) throw new Error("Seattle site not found");

    const climbersLoc = seaLoc + 2;
    const climbersString = ary[climbersLoc];
    if (climbersString.trim().length === 0 || !climbersString) {
      throw new Error("Climbers string is empty");
    }

    var onlyNumbersRegex = /\d+/g;
    var numbers = (climbersString as any).match(onlyNumbersRegex).join("");

    if (!numbers) throw new Error("Number of climbers not found");

    const numbersAsInt = parseInt(numbers, 10);
    result = numbersAsInt;
  } catch (err) {
    console.warn("Could not scrape from site: ", err);
  }

  await browser.close();
  if (!result) throw new Error("Result not found");

  return result;
};

const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const main = async () => {
  const openHours = [
    [8, 19], // Sunday 8am - 7pm
    [6, 22], // Monday 6am - 10pm
    [6, 22], // Tuesday 6am - 10pm
    [6, 22], // Wednesday 6am - 10pm
    [6, 22], // Thursday 6am - 10pm
    [6, 22], // Friday 6am - 10pm
    [8, 22], // Saturday 8am - 10pm
  ];

  const date = new Date();
  const day = date.getDay(); // int, 0 for Sunday
  const dayStr = days[day];
  if (!dayStr) throw new Error("Invalid day");
  const [minHour = 0, maxHour = 24] = openHours[day];
  const hour = date.getHours();
  if (hour < minHour || hour >= maxHour) {
    console.log("Gym closed", dayStr, hour % 12);
    return;
  } else {
    console.log("Gym open ", dayStr, hour % 12);
  }

  try {
    const climbers = await scrapeFromSite();
    addNewClimberLog({
      date: new Date(),
      climbers,
    });
  } catch (err) {
    console.warn("Could not get climbers due to previous error.");
  }
};

setInterval(main, 1000 * 60 * 3); // every 3 minutes

main();
