// Import ioredis.
// You can also use `import { Redis } from "ioredis"`
// if your project is a TypeScript project,
// Note that `import Redis from "ioredis"` is still supported,
// but will be deprecated in the next major version.
const Redis = require('ioredis');

// Create a Redis instance.
// By default, it will connect to localhost:6379.
// We are going to cover how to specify connection options soon.
const redis = new Redis();

redis.set('mykey', 'value'); // Returns a promise which resolves to "OK" when the command succeeds.

// ioredis supports the node.js callback style
redis.get('mykey', (err: unknown, result: unknown) => {
  if (err) {
    console.error(err);
  } else {
    console.log('redis io:', result); // Prints "value"
  }
});
