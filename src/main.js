const fetchAndSave = require("./fetchData");
const fs = require("fs");
const { sortObj, getChoices } = require("./utils");

/*fetchAndSave(2021, 22, "results/2021_results.json")
  .catch(err => console.log(err))
  .then(() => console.log("Done!"));*/

const place_bonuses = [
  25, 18, 15, 12, 10, 8, 6, 4, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
];
const year = 2021;

// ############### Score util functions ################
const mergeScore = (new_score, destination) => {
  const { drivers, constructors } = new_score;
  for (const key in drivers) {
    if (destination.drivers[key] == undefined) {
      destination.drivers[key] = 0;
    }
    destination.drivers[key] += drivers[key];
  }
  for (const key in constructors) {
    if (destination.constructors[key] == undefined) {
      destination.constructors[key] = 0;
    }
    destination.constructors[key] += constructors[key];
  }
};

const forResult = (results, func, reset = () => {}) => {
  const drivers = {};
  const constructors = {};

  for (const i in results) {
    reset(results[i]);
    for (const driver of results[i]) {
      if (drivers[driver.driverId] == undefined) {
        drivers[driver.driverId] = 0;
      }

      if (constructors[driver.constructorId] == undefined) {
        constructors[driver.constructorId] = 0;
      }

      func(driver, drivers, constructors);
    }
  }
  return { drivers, constructors };
};

//  ###################################################

const getResultsScore = results =>
  forResult(results, (driver, drivers, constructors) => {
    if (driver.fastestLap) {
      drivers[driver.driverId]++;
      constructors[driver.constructorId]++;
    }
    drivers[driver.driverId] += place_bonuses[driver.position - 1];
    constructors[driver.constructorId] += place_bonuses[driver.position - 1];
  });

const getStreakScore = (results, qualifying) => {
  const score = { drivers: {}, constructors: {} };
  /**
   * {
   *  "driverId": {"streak": int, "keep": bool}
   * }
   */
  let driverStreak = {};
  /**
   * {
   *  "constructorId": {"streak": int, "driver_count": int}
   * }
   */
  let constStreak = {};

  const data = [results, qualifying];
  const reward = [10, 5];

  for (const i in data) {
    driverStreak = {};
    constStreak = {};
    const res = forResult(
      data[i],
      (driver, drivers, constructors) => {
        if (driver.position > 10) return;

        // Driver streak
        if (driverStreak[driver.driverId] == undefined) {
          driverStreak[driver.driverId] = { streak: 1, keep: true };
        } else {
          driverStreak[driver.driverId].streak += 1;
          driverStreak[driver.driverId].keep = true;
        }
        if (driverStreak[driver.driverId].streak == 5) {
          constructors[driver.constructorId] += reward[i];
          drivers[driver.driverId] += reward[i];
          delete driverStreak[driver.driverId];
        }

        // Constructors streak
        if (constStreak[driver.constructorId] == undefined) {
          constStreak[driver.constructorId] = { streak: 0, driver_count: 1 };
        } else if (constStreak[driver.constructorId] == 1) {
          constStreak[driver.constructorId].streak += 1;
          constStreak[driver.constructorId].driver_count += 1;
        } else {
          constStreak[driver.constructorId].driver_count += 1;
        }
        if (constStreak[driver.constructorId].streak == 3) {
          constructors[driver.constructorId] += reward[i];
          drivers[driver.driverId] += reward[i];
          delete constStreak[driver.driverId];
        }
      },
      () => {
        // Resetting streaks
        for (const i in driverStreak) {
          if (!driverStreak[i].keep) {
            delete driverStreak[i];
          } else {
            driverStreak[i].keep = false;
          }
        }
        for (const i in constStreak) {
          if (constStreak[i].driver_count < 2) {
            delete constStreak[i];
          } else {
            constStreak[i].driver_count = 0;
          }
        }
      },
    );
    mergeScore(res, score);
  }
  return score;
};

const getRaceExtraBonuses = results => {
  let teamMate = {};
  let race_laps = 0;

  return forResult(
    results,
    (driver, drivers, constructors) => {
      // Finished race
      if (driver.laps >= race_laps * 0.9) {
        drivers[driver.driverId] += 1;
        constructors[driver.constructorId] += 1;
      }

      // Per position gained/lost
      if (Math.abs(driver.grid - driver.position) <= 10) {
        drivers[driver.driverId] += driver.grid - driver.position;
        constructors[driver.constructorId] += driver.grid - driver.position;
      } else {
        const score = driver.grid - driver.position > 0 ? 10 : -10;
        drivers[driver.driverId] += score;
        constructors[driver.constructorId] += score;
      }

      // Finished ahead of team mate
      if (teamMate[driver.constructorId] == undefined) {
        teamMate[driver.constructorId] = driver;
      } else {
        if (teamMate[driver.constructorId].position < driver.position) {
          drivers[teamMate[driver.constructorId].driverId] += 3;
        } else {
          drivers[driver.driverId] += 3;
        }
      }
    },
    result => {
      teamMate = {};
      race_laps = result[0].laps;
    },
  );
};

const getQualificationScore = qualifying => {
  let teamMate = [];
  return forResult(
    qualifying,
    (driver, drivers, constructors) => {
      // Q1 Q2 Q3?
      if (driver.q3) {
        drivers[driver.driverId] += 3;
        constructors[driver.constructorId] += 3;
      } else if (driver.q2) {
        driver[driver.driverId] += 2;
        constructors[driver.constructorId] += 2;
      } else if (driver.q1) {
        driver[driver.driverId] += 1;
        constructors[driver.constructorId] += 1;
      } else {
        driver[driver.driverId] -= 5;
        constructors[driver.constructorId] -= 5;
      }

      // Bonus
      if (driver.position <= 10) {
        drivers[driver.driverId] += 11 - driver.position;
        constructors[driver.constructorId] += 11 - driver.position;
      }

      // Qualifying ahead of team mate
      if (teamMate[driver.constructorId] == undefined) {
        teamMate[driver.constructorId] = driver;
      } else {
        if (teamMate[driver.constructorId].position < driver.position) {
          drivers[teamMate[driver.constructorId].driverId] += 2;
        } else {
          drivers[driver.driverId] += 2;
        }
      }
    },
    () => {
      teamMate = {};
    },
  );
};

const calculateScore = () => {
  const { results, qualifying, sprints } = JSON.parse(
    String(fs.readFileSync("results/2021_results.json")),
  );
  let score = { drivers: {}, constructors: {} };
  mergeScore(getResultsScore(results), score);
  mergeScore(getRaceExtraBonuses(results), score);
  mergeScore(getQualificationScore(qualifying), score);
  mergeScore(getStreakScore(results, qualifying), score);

  return score;
};

const constructorsPrise = {
  mercedes: 34.5,
  red_bull: 32.5,
  ferrari: 25.0,
  mclaren: 18.5,
  alpine: 14.0,
  alphatauri: 10.5,
  aston_martin: 11.5,
  alfa: 8.0,
  williams: 7.0,
  haas: 6.0,
};

const driverPrise = {
  hamilton: 31.0,
  max_verstappen: 30.5,
  bottas: 24.0,
  norris: 16.0,
  sainz: 17.0,
  leclerc: 18.0,
  perez: 17.5,
  gasly: 13.5,
  ricciardo: 14.5,
  alonso: 12.5,
  ocon: 12.0,
  stroll: 9.5,
  vettel: 9.0,
  russell: 7.5,
  mick_schumacher: 6.5,
  tsunoda: 8.5,
  raikkonen: 9.0,
  mazepin: 5.5,
  latifi: 7.0,
  giovinazzi: 8.0,
};

const score = calculateScore();
console.log("Drivers score:");
console.log(sortObj(score.drivers));

console.log("\nConstructors score:");
console.log(sortObj(score.constructors));

console.log("\nPrise per point drivers:");
const prisePerPoint = { drivers: {}, constructors: {} };
for (const i in driverPrise) {
  prisePerPoint.drivers[i] = driverPrise[i] / score.drivers[i];
}

for (const i in constructorsPrise) {
  prisePerPoint.constructors[i] = constructorsPrise[i] / score.constructors[i];
}

const choices = getChoices(Object.keys(driverPrise), 5);

let costs = [];
for (const i in choices) {
  let cost = 0;
  for (const driver of choices[i]) cost += driverPrise[driver];
  costs.push(cost);
}

let scores = [];
for (const i in choices) {
  let choice_score = 0;
  for (const driver of choices[i]) choice_score += score.drivers[driver];
  scores.push(choice_score);
}

let optimal_i = 0;
let optimal_constructor = "";
let best_score = 0;
for (const i in choices) {
  for (const c in constructorsPrise) {
    if (costs[i] + constructorsPrise[c] > 100) continue;
    if (scores[i] + score.constructors[c] > best_score) {
      best_score = scores[i] + score.constructors[c];
      optimal_i = i;
      optimal_constructor = c;
    }
  }
}

console.log("Optimal drivers:", choices[optimal_i]);
console.log("Optimal constructor:", optimal_constructor);
console.log(
  "Points:",
  scores[optimal_i] + score.constructors[optimal_constructor],
);
console.log(
  "Prise:",
  costs[optimal_i] + constructorsPrise[optimal_constructor],
);
