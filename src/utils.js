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

module.exports = { to, sortObj };
