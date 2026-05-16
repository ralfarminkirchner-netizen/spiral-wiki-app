/** Simple concurrency limiter similar to p-limit */
export default function pLimit(concurrency) {
  const queue = [];
  let active = 0;
  const next = () => {
    if (queue.length === 0) return;
    if (active >= concurrency) return;
    const fn = queue.shift();
    active++;
    fn().then(() => {
      active--;
      next();
    }).catch(() => {
      active--;
      next();
    });
  };
  return (fn) => new Promise((resolve, reject) => {
    queue.push(() => fn().then(resolve).catch(reject));
    next();
  });
}
