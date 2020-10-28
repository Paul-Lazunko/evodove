export const makeGenerator = function* (data: any[]) {
  for (let i = 0; i < data.length; i++) {
    yield data[i];
  }
};
