const Axios = require("axios").default;
const fs = require("fs");
const { to } = require("./utils");

const getQualifying = (year, gp_id) =>
  Axios.get(`https://ergast.com/api/f1/${year}/${gp_id}/qualifying.json`);

const getRace = (year, gp_id) =>
  Axios.get(`https://ergast.com/api/f1/${year}/${gp_id}/results.json`);

const getSprint = (year, gp_id) =>
  Axios.get(`https://ergast.com/api/f1/${year}/${gp_id}/sprint.json`);

const isEmpty = rawRes =>
  rawRes
    ? rawRes.MRData
      ? rawRes.MRData.RaceTable
        ? rawRes.MRData.RaceTable.Races
          ? rawRes.MRData.RaceTable.Races.length <= 0
          : true
        : true
      : true
    : true;

/**
 * @returns
 * [{
 *    driverId: "string",
 *    constructorId: "string",
 *    position: int,
 *    q1: boolean,
 *    q2: boolean,
 *    q3: boolean,
 * }]
 */
const formatQualifying = rawQualiRes => {
  if (!rawQualiRes || isEmpty(rawQualiRes)) return [];
  const results = rawQualiRes.MRData.RaceTable.Races[0].QualifyingResults;
  const drivers = [];
  for (i in results) {
    drivers.push({
      driverId: results[i].Driver.driverId,
      constructorId: results[i].Constructor.constructorId,
      position: Number(results[i].position),
      q1: results[i].Q1 && results[i].Q1 != "",
      q2: results[i].Q2 && results[i].Q2 != "",
      q3: results[i].Q3 && results[i].Q3 != "",
    });
  }
  return drivers;
};

/**
 * @returns
 * [{
 *    driverId: "string",
 *    constructorId: "string",
 *    position: int,
 *    points: int,
 *    laps: int,
 *    grid: int,
 * }]
 */
const formatRace = rawRaceRes => {
  if (!rawRaceRes || isEmpty(rawRaceRes)) return [];
  const results = rawRaceRes.MRData.RaceTable.Races[0].Results;
  const drivers = [];
  for (i in results) {
    drivers.push({
      driverId: results[i].Driver.driverId,
      constructorId: results[i].Constructor.constructorId,
      position: Number(results[i].position),
      points: Number(results[i].points),
      laps: Number(results[i].laps),
      grid: Number(results[i].grid),
      fastestLap: results[i].FastestLap
        ? results[i].FastestLap.rank === "1"
        : false,
    });
  }
  return drivers;
};

const fetchAndSave = async (year, n_rounds, path) => {
  const results = {};
  const qualifying = {};
  const sprints = {};

  for (let i = 1; i <= n_rounds; i++) {
    let [err, res] = await to(getRace(year, i));
    if (err) {
      console.log(`Failed year: ${year}, race: ${i}`);
      console.log(err.message);
      return;
    }

    if (!isEmpty(res.data)) {
      results[String(i)] = formatRace(res.data);
    }

    [err, res] = await to(getQualifying(year, i));
    if (err) {
      console.log(`Failed year: ${year}, race: ${i}`);
      console.log(err.message);
      return;
    }

    if (!isEmpty(res.data)) {
      qualifying[String(i)] = formatQualifying(res.data);
    }
  }

  fs.writeFileSync(path, JSON.stringify({ results, qualifying, sprints }));
};

module.exports = fetchAndSave;
