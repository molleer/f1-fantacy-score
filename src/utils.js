const sortObj = obj => {
  return Object.keys(obj)
    .sort((a, b) => obj[b] - obj[a])
    .reduce(function (result, key) {
      result[key] = obj[key];
      return result;
    }, {});
};

const to = promise => {
  if (Array.isArray(promise)) {
    return Promise.all(promise)
      .then(res => [null, res])
      .catch(err => [err, []]);
  }

  return promise
    .then(data => {
      return [null, data];
    })
    .catch(err => [err]);
};

const getChoices = (arr, choose = 0) => {
  if (choose === 0) return [];
  if (choose === 1) return arr.map(e => [e]);
  if (arr.length === 0) return [];

  const choices = [];
  const other = [...arr];

  for (const i in arr) {
    other.shift();
    const otherChoices = getChoices(other, choose - 1);
    for (const k in otherChoices) choices.push([arr[i], ...otherChoices[k]]);
  }
  return choices;
};

module.exports = { to, sortObj, getChoices };
