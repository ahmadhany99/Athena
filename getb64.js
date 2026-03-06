const https = require("https");
const fs = require("fs");

https.get(
  "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Montreal-metro.svg/800px-Montreal-metro.svg.png",
  {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
  },
  (res) => {
    if (res.statusCode !== 200) {
      console.error("Failed to fetch:", res.statusCode);
      return;
    }
    let chunks = [];
    res.on("data", (c) => chunks.push(c));
    res.on("end", () => {
      const buffer = Buffer.concat(chunks);
      fs.writeFileSync("b64.txt", buffer.toString("base64"));
      console.log("done");
    });
  },
);
