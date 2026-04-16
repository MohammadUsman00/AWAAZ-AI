import { openDatabase, setDbForTests } from '../server/db/index.js';

setDbForTests(openDatabase(':memory:'));
