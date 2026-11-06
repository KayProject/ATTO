import { titleSearch } from "./index";
for (const name of process.argv.slice(2)) console.log(JSON.stringify(await titleSearch(name), null, 2));
